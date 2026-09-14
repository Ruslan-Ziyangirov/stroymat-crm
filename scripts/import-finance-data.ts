/**
 * Одноразовый импорт исторических финансовых данных, присланных вручную:
 * помесячные выгрузки «Анализ счёта 51» из 1С и годовая бухгалтерская
 * отчётность (баланс + ОФР) в PDF. Требует применённую миграцию
 * supabase/migrations/0004_finance.sql и SUPABASE_SERVICE_ROLE_KEY в .env.local.
 *
 * Запуск: npx tsx scripts/import-finance-data.ts <папка "Анализ 51 счета"> <папка с PDF балансов> [email загрузившего]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseCashFlow51, parseFinancialStatement } from "../src/lib/analytics/finance-parser";

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function main() {
  loadEnvLocal();

  const [, , cashFlowDirArg, statementsDirArg, uploaderEmailArg] = process.argv;
  if (!cashFlowDirArg || !statementsDirArg) {
    console.error(
      "Использование: npx tsx scripts/import-finance-data.ts <папка 'Анализ 51 счета'> <папка с PDF балансов> [email]",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Не найдены NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в .env.local");
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let uploadedBy: string | null = null;
  if (uploaderEmailArg) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", uploaderEmailArg)
      .maybeSingle();
    uploadedBy = data?.id ?? null;
  }

  let cfOk = 0;
  let cfSkip = 0;

  const years = fs.readdirSync(cashFlowDirArg).filter((y) => fs.statSync(path.join(cashFlowDirArg, y)).isDirectory());
  for (const year of years) {
    const yearDir = path.join(cashFlowDirArg, year);
    for (const file of fs.readdirSync(yearDir)) {
      const filePath = path.join(yearDir, file);
      const buf = fs.readFileSync(filePath);
      try {
        const parsed = parseCashFlow51(toArrayBuffer(buf));

        const { data: upload, error: upErr } = await supabase
          .from("finance_uploads")
          .insert({
            kind: "cash_flow_51",
            file_name: file,
            period_month: parsed.periodMonth,
            status: "uploaded",
            uploaded_by: uploadedBy,
          })
          .select("id")
          .single();
        if (upErr) throw new Error(upErr.message);

        const ext = path.extname(file);
        const storagePath = `finance/cash-flow/${upload.id}${ext}`;
        const { error: storageError } = await supabase.storage
          .from("reports")
          .upload(storagePath, buf, { contentType: "application/vnd.ms-excel", upsert: true });

        const { error: rowsErr } = await supabase.from("finance_cash_flow_rows").insert(
          parsed.rows.map((r) => ({
            upload_id: upload.id,
            period_month: parsed.periodMonth,
            corr_account: r.corr_account,
            debit: r.debit,
            credit: r.credit,
            comment: r.comment,
            raw: r.raw,
          })),
        );
        if (rowsErr) throw new Error(rowsErr.message);

        const sumDebit = parsed.rows.reduce((s, r) => s + (r.debit ?? 0), 0);
        const sumCredit = parsed.rows.reduce((s, r) => s + (r.credit ?? 0), 0);
        const turnoverMismatch =
          (parsed.turnoverDebit !== null && Math.abs(sumDebit - parsed.turnoverDebit) > 1) ||
          (parsed.turnoverCredit !== null && Math.abs(sumCredit - parsed.turnoverCredit) > 1);

        await supabase
          .from("finance_uploads")
          .update({
            status: "parsed",
            file_path: storageError ? null : storagePath,
            rows_count: parsed.rows.length,
            summary: {
              openingBalance: parsed.openingBalance,
              closingBalance: parsed.closingBalance,
              turnoverDebit: parsed.turnoverDebit,
              turnoverCredit: parsed.turnoverCredit,
              turnoverMismatch,
            },
            error: storageError ? `Файл не сохранён в хранилище: ${storageError.message}` : null,
          })
          .eq("id", upload.id);

        cfOk += 1;
        console.log(
          `OK  cash-flow  ${year}/${file} -> ${parsed.periodMonth}, ${parsed.rows.length} строк${turnoverMismatch ? " (расхождение с 'Оборот')" : ""}`,
        );
      } catch (error) {
        cfSkip += 1;
        console.log(`SKIP cash-flow  ${year}/${file}: ${(error as Error).message}`);
      }
    }
  }

  let stOk = 0;
  let stFail = 0;
  const statementFiles = fs.readdirSync(statementsDirArg).filter((f) => f.toLowerCase().endsWith(".pdf"));
  for (const file of statementFiles) {
    const filePath = path.join(statementsDirArg, file);
    const buf = fs.readFileSync(filePath);
    try {
      const parsed = await parseFinancialStatement(buf);

      const { data: upload, error: upErr } = await supabase
        .from("finance_uploads")
        .insert({
          kind: "financial_statement",
          file_name: file,
          period_year: parsed.periodYear,
          status: "uploaded",
          uploaded_by: uploadedBy,
        })
        .select("id")
        .single();
      if (upErr) throw new Error(upErr.message);

      const statementExt = path.extname(file);
      const storagePath = `finance/statements/${upload.id}${statementExt}`;
      const { error: storageError } = await supabase.storage
        .from("reports")
        .upload(storagePath, buf, { contentType: "application/pdf", upsert: true });

      const { error: linesErr } = await supabase.from("finance_statement_lines").insert(
        parsed.lines.map((line, index) => ({
          upload_id: upload.id,
          period_year: parsed.periodYear,
          statement_type: line.statement_type,
          code: line.code,
          label: line.label,
          value: line.value,
          position: index,
        })),
      );
      if (linesErr) throw new Error(linesErr.message);

      await supabase
        .from("finance_uploads")
        .update({
          status: "parsed",
          file_path: storageError ? null : storagePath,
          rows_count: parsed.lines.length,
          summary: { orgName: parsed.orgName, inn: parsed.inn },
          error: storageError ? `Файл не сохранён в хранилище: ${storageError.message}` : null,
        })
        .eq("id", upload.id);

      stOk += 1;
      console.log(`OK  statement   ${file} -> ${parsed.periodYear} г., ${parsed.lines.length} строк`);
    } catch (error) {
      stFail += 1;
      console.log(`FAIL statement  ${file}: ${(error as Error).message}`);
    }
  }

  console.log(
    `\nГотово. Анализ счёта 51: ${cfOk} загружено, ${cfSkip} пропущено (годовые своды). Отчётность: ${stOk} загружено, ${stFail} с ошибкой.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
