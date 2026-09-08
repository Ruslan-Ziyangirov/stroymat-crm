"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { integrationSchema } from "@/lib/validations";
import type { MutationResult } from "@/lib/actions/clients";

export async function updateIntegrationSettings(
  values: unknown,
): Promise<MutationResult> {
  const parsed = integrationSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("integration_settings")
    .update({
      is_enabled: parsed.data.is_enabled,
      base_url: parsed.data.base_url ?? null,
      username: parsed.data.username ?? null,
      sync_clients: parsed.data.sync_clients,
      sync_orders: parsed.data.sync_orders,
      sync_bonuses: parsed.data.sync_bonuses,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/integration");
  return { ok: true };
}

/**
 * Пробный запрос к базе 1С по адресу из настроек.
 * Проверяет, что сервер отвечает и доступен из сети приложения.
 */
export async function testIntegrationConnection(): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("integration_settings")
    .select("base_url")
    .eq("id", true)
    .maybeSingle();

  if (!data?.base_url) {
    return { ok: false, error: "Сначала укажите адрес базы 1С" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(data.base_url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    await supabase.from("sync_log").insert({
      direction: "out",
      entity: "ping",
      status: response.ok ? "ok" : "error",
      message: `Проверка соединения: HTTP ${response.status}`,
    });

    revalidatePath("/integration");
    return response.ok
      ? { ok: true }
      : { ok: false, error: `База 1С ответила кодом ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Соединение не установлено";
    await supabase.from("sync_log").insert({
      direction: "out",
      entity: "ping",
      status: "error",
      message: `Проверка соединения: ${message}`,
    });
    revalidatePath("/integration");
    return { ok: false, error: message };
  }
}
