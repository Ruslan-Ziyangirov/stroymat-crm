import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, disabledResponse, isSyncEnabled, logSync } from "@/lib/integration/api";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  transactions: z
    .array(
      z.object({
        client_external_id: z.string().min(1),
        type: z.enum(["accrual", "redeem", "manual", "sync_1c"]).optional(),
        points: z.number(),
        comment: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

/** Текущие балансы бонусов для 1С. */
export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!(await isSyncEnabled(admin, "sync_bonuses"))) return disabledResponse();

  const clientId = new URL(request.url).searchParams.get("client");

  let query = admin
    .from("clients")
    .select("id, external_1c_id, name, bonus_balance")
    .order("name")
    .limit(1000);

  if (clientId) query = query.eq("external_1c_id", clientId);

  const { data, error } = await query;

  if (error) {
    await logSync(admin, {
      direction: "out",
      entity: "bonus",
      status: "error",
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSync(admin, {
    direction: "out",
    entity: "bonus",
    status: "ok",
    message: `Отдано балансов: ${data?.length ?? 0}`,
  });

  return NextResponse.json({ balances: data ?? [] });
}

/** Проведение бонусных операций, пришедших из 1С. */
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!(await isSyncEnabled(admin, "sync_bonuses"))) return disabledResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const results: { client_external_id: string; ok: boolean; error?: string }[] = [];

  for (const tx of parsed.data.transactions) {
    const { data: client } = await admin
      .from("clients")
      .select("id, bonus_balance")
      .eq("external_1c_id", tx.client_external_id)
      .maybeSingle();

    if (!client) {
      results.push({
        client_external_id: tx.client_external_id,
        ok: false,
        error: "Клиент не найден в CRM",
      });
      continue;
    }

    const type = tx.points < 0 ? "redeem" : (tx.type ?? "sync_1c");
    const points = Math.abs(tx.points);

    if (type === "redeem" && Number(client.bonus_balance) < points) {
      results.push({
        client_external_id: tx.client_external_id,
        ok: false,
        error: `Недостаточно баллов: на балансе ${client.bonus_balance}`,
      });
      continue;
    }

    const { error } = await admin.from("bonus_transactions").insert({
      client_id: client.id,
      type,
      points,
      comment: tx.comment ?? "Синхронизация с 1С",
    });

    results.push({
      client_external_id: tx.client_external_id,
      ok: !error,
      error: error?.message,
    });
  }

  const failed = results.filter((r) => !r.ok);
  await logSync(admin, {
    direction: "in",
    entity: "bonus",
    status: failed.length ? "error" : "ok",
    message: `Проведено операций: ${results.length - failed.length}, с ошибками: ${failed.length}`,
    payload: failed.length ? failed : null,
  });

  return NextResponse.json({ results });
}
