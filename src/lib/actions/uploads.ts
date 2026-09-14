"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { parseReportFile } from "@/lib/analytics/report-parser";
import { aggregateRows, buildUploadInsights } from "@/lib/analytics/insights";
import type { MutationResult } from "@/lib/actions/clients";

const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ

/**
 * Принимает выгрузку (.xlsx/.csv), распознаёт колонки, сохраняет строки
 * и сразу считает свод и краткие выводы.
 */
export async function uploadReport(formData: FormData): Promise<MutationResult> {
  const profile = await requireProfile();
  const file = formData.get("file");
  const storeId = formData.get("store_id");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Выберите файл отчёта" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "Файл больше 10 МБ" };
  }

  const supabase = await createClient();

  const { data: upload, error: uploadError } = await supabase
    .from("report_uploads")
    .insert({
      file_name: file.name,
      store_id: typeof storeId === "string" && storeId ? storeId : null,
      status: "uploaded",
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (uploadError) return { ok: false, error: uploadError.message };

  try {
    const buffer = await file.arrayBuffer();
    const parsed = await parseReportFile(file.name, buffer);

    if (!parsed.rows.length) {
      throw new Error(
        "Не удалось распознать ни одной строки. Проверьте, что в файле есть колонки «Дата», «Сумма», «Номенклатура».",
      );
    }

    // Файл кладём в Storage — чтобы всегда можно было вернуться к оригиналу.
    // Ключ объекта должен быть ASCII — оригинальное имя (в т.ч. кириллица)
    // хранится отдельно в file_name и показывается в интерфейсе.
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const path = `${profile.id}/${upload.id}${ext}`;
    const { error: storageError } = await supabase.storage
      .from("reports")
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    const aggregate = aggregateRows(parsed.rows);
    const insights = buildUploadInsights(aggregate);

    const { error: rowsError } = await supabase.from("report_rows").insert(
      parsed.rows.map((row) => ({
        upload_id: upload.id,
        store_id: typeof storeId === "string" && storeId ? storeId : null,
        doc_date: row.doc_date,
        period_month: row.period_month,
        client_name: row.client_name,
        order_number: row.order_number,
        product_name: row.product_name,
        category: row.category,
        quantity: row.quantity,
        amount: row.amount,
        raw: row.raw,
      })),
    );
    if (rowsError) throw new Error(rowsError.message);

    const monthKeys = aggregate.months.map((m) => m.month).sort();

    await supabase
      .from("report_uploads")
      .update({
        status: "parsed",
        file_path: storageError ? null : path,
        rows_count: parsed.rows.length,
        total_amount: aggregate.totalAmount,
        period_start: monthKeys[0] ?? null,
        period_end: monthKeys[monthKeys.length - 1] ?? null,
        summary: {
          columns: parsed.columns,
          months: aggregate.months,
          topProducts: aggregate.topProducts,
          topClients: aggregate.topClients,
          insights,
        },
        error: storageError ? `Файл не сохранён в хранилище: ${storageError.message}` : null,
      })
      .eq("id", upload.id);

    revalidatePath("/uploads");
    return { ok: true, id: upload.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка разбора файла";
    await supabase
      .from("report_uploads")
      .update({ status: "failed", error: message })
      .eq("id", upload.id);
    revalidatePath("/uploads");
    return { ok: false, error: message };
  }
}

export async function deleteUpload(id: string): Promise<MutationResult> {
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("report_uploads")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  if (data?.file_path) {
    await supabase.storage.from("reports").remove([data.file_path]);
  }

  const { error } = await supabase.from("report_uploads").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/uploads");
  return { ok: true };
}
