import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";

export type Admin = ReturnType<typeof createAdminClient>;

/** Проверяет ключ интеграции из заголовка x-api-key. */
export function authorize(request: Request): NextResponse | null {
  const expected = readEnv("INTEGRATION_1C_API_KEY");
  if (!expected) {
    return NextResponse.json(
      { error: "Интеграция не настроена: не задан INTEGRATION_1C_API_KEY" },
      { status: 503 },
    );
  }

  const provided =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (provided !== expected) {
    return NextResponse.json({ error: "Неверный ключ интеграции" }, { status: 401 });
  }
  return null;
}

/** Пишет результат обмена в журнал синхронизации. */
export async function logSync(
  admin: Admin,
  entry: {
    direction: "in" | "out";
    entity: string;
    status: "ok" | "error";
    message?: string;
    payload?: unknown;
  },
) {
  await admin.from("sync_log").insert({
    direction: entry.direction,
    entity: entry.entity,
    status: entry.status,
    message: entry.message ?? null,
    payload: entry.payload ?? null,
  });

  if (entry.status === "ok") {
    await admin
      .from("integration_settings")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", true);
  }
}

/** Проверяет, что обмен по сущности включён в настройках. */
export async function isSyncEnabled(
  admin: Admin,
  field: "sync_clients" | "sync_orders" | "sync_bonuses",
) {
  const { data } = await admin
    .from("integration_settings")
    .select("is_enabled, sync_clients, sync_orders, sync_bonuses")
    .eq("id", true)
    .maybeSingle();

  if (!data) return false;
  return Boolean(data.is_enabled && data[field]);
}

export function disabledResponse() {
  return NextResponse.json(
    { error: "Обмен по этой сущности выключен в настройках CRM" },
    { status: 409 },
  );
}
