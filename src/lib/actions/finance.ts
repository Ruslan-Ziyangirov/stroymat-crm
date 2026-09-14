"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { parseCashFlow51, parseFinancialStatement } from "@/lib/analytics/finance-parser";
import type { MutationResult } from "@/lib/actions/clients";

const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ

/**
 * Загружает помесячную выгрузку «Анализ счёта 51» из 1С (.xls/.xlsx) —
 * движение денег по расчётному счёту с разбивкой по статьям.
 */
export async function uploadCashFlow(formData: FormData): Promise<MutationResult> {
  const profile = await requireRole(["admin", "director"]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл отчёта" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "Файл больше 10 МБ" };
  }

  const supabase = await createClient();

  const { data: upload, error: uploadError } = await supabase
    .from("finance_uploads")
    .insert({
      kind: "cash_flow_51",
      file_name: file.name,
      status: "uploaded",
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (uploadError) return { ok: false, error: uploadError.message };

  try {
    const buffer = await file.arrayBuffer();
    const parsed = parseCashFlow51(buffer);

    // Ключ объекта в Storage должен быть ASCII — оригинальное имя (в т.ч. кириллица)
    // хранится отдельно в file_name и показывается в интерфейсе.
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const path = `finance/cash-flow/${upload.id}${ext}`;
    const { error: storageError } = await supabase.storage
      .from("reports")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    const { error: rowsError } = await supabase.from("finance_cash_flow_rows").insert(
      parsed.rows.map((row) => ({
        upload_id: upload.id,
        period_month: parsed.periodMonth,
        corr_account: row.corr_account,
        debit: row.debit,
        credit: row.credit,
        comment: row.comment,
        raw: row.raw,
      })),
    );
    if (rowsError) throw new Error(rowsError.message);

    const sumDebit = parsed.rows.reduce((s, r) => s + (r.debit ?? 0), 0);
    const sumCredit = parsed.rows.reduce((s, r) => s + (r.credit ?? 0), 0);
    const turnoverMismatch =
      (parsed.turnoverDebit !== null && Math.abs(sumDebit - parsed.turnoverDebit) > 1) ||
      (parsed.turnoverCredit !== null && Math.abs(sumCredit - parsed.turnoverCredit) > 1);

    await supabase
      .from("finance_uploads")
      .update({
        status: "parsed",
        file_path: storageError ? null : path,
        period_month: parsed.periodMonth,
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

    revalidatePath("/finance");
    return { ok: true, id: upload.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка разбора файла";
    await supabase.from("finance_uploads").update({ status: "failed", error: message }).eq("id", upload.id);
    revalidatePath("/finance");
    return { ok: false, error: message };
  }
}

/** Загружает годовую бухгалтерскую отчётность (баланс + ОФР) в формате PDF. */
export async function uploadFinancialStatement(formData: FormData): Promise<MutationResult> {
  const profile = await requireRole(["admin", "director"]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл отчёта" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "Файл больше 10 МБ" };
  }

  const supabase = await createClient();

  const { data: upload, error: uploadError } = await supabase
    .from("finance_uploads")
    .insert({
      kind: "financial_statement",
      file_name: file.name,
      status: "uploaded",
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (uploadError) return { ok: false, error: uploadError.message };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parseFinancialStatement(Buffer.from(arrayBuffer));

    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const path = `finance/statements/${upload.id}${ext}`;
    const { error: storageError } = await supabase.storage
      .from("reports")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    const { error: linesError } = await supabase.from("finance_statement_lines").insert(
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
    if (linesError) throw new Error(linesError.message);

    await supabase
      .from("finance_uploads")
      .update({
        status: "parsed",
        file_path: storageError ? null : path,
        period_year: parsed.periodYear,
        rows_count: parsed.lines.length,
        summary: { orgName: parsed.orgName, inn: parsed.inn },
        error: storageError ? `Файл не сохранён в хранилище: ${storageError.message}` : null,
      })
      .eq("id", upload.id);

    revalidatePath("/finance");
    return { ok: true, id: upload.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка разбора файла";
    await supabase.from("finance_uploads").update({ status: "failed", error: message }).eq("id", upload.id);
    revalidatePath("/finance");
    return { ok: false, error: message };
  }
}

export async function deleteFinanceUpload(id: string): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("finance_uploads")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (data?.file_path) {
    await supabase.storage.from("reports").remove([data.file_path]);
  }

  const { error } = await supabase.from("finance_uploads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/finance");
  return { ok: true };
}
