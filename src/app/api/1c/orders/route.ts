import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, disabledResponse, isSyncEnabled, logSync } from "@/lib/integration/api";

export const dynamic = "force-dynamic";

const incomingOrder = z.object({
  external_1c_id: z.string().min(1),
  client_external_id: z.string().min(1),
  number: z.string().optional(),
  created_at: z.string().optional(),
  discount_percent: z.number().min(0).max(50).optional(),
  comment: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        unit: z.string().optional(),
        quantity: z.number().positive(),
        price: z.number().min(0),
      }),
    )
    .min(1),
});

const payloadSchema = z.object({ orders: z.array(incomingOrder).min(1) });

/** Выгрузка заказов из CRM в 1С. */
export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!(await isSyncEnabled(admin, "sync_orders"))) return disabledResponse();

  const params = new URL(request.url).searchParams;
  const since = params.get("since");

  let query = admin
    .from("orders")
    .select(
      "id, external_1c_id, number, total, items_total, discount_percent, bonus_used, bonus_earned, created_at, updated_at, client:clients(id, external_1c_id, name, inn), items:order_items(name, unit, quantity, price, amount)",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (since) query = query.gte("updated_at", since);

  const { data, error } = await query;

  if (error) {
    await logSync(admin, {
      direction: "out",
      entity: "order",
      status: "error",
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSync(admin, {
    direction: "out",
    entity: "order",
    status: "ok",
    message: `Отдано заказов: ${data?.length ?? 0}`,
  });

  return NextResponse.json({ orders: data ?? [] });
}

/** Загрузка заказов из 1С в CRM. */
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!(await isSyncEnabled(admin, "sync_orders"))) return disabledResponse();

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

  const results: { external_1c_id: string; ok: boolean; error?: string }[] = [];

  for (const order of parsed.data.orders) {
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("external_1c_id", order.client_external_id)
      .maybeSingle();

    if (!client) {
      results.push({
        external_1c_id: order.external_1c_id,
        ok: false,
        error: `Клиент ${order.client_external_id} не найден в CRM`,
      });
      continue;
    }

    const { data: saved, error } = await admin
      .from("orders")
      .upsert(
        {
          external_1c_id: order.external_1c_id,
          client_id: client.id,
          discount_percent: order.discount_percent ?? 0,
          comment: order.comment ?? null,
          ...(order.number ? { number: order.number } : {}),
          ...(order.created_at ? { created_at: order.created_at } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "external_1c_id" },
      )
      .select("id")
      .single();

    if (error || !saved) {
      results.push({
        external_1c_id: order.external_1c_id,
        ok: false,
        error: error?.message ?? "Не удалось сохранить заказ",
      });
      continue;
    }

    await admin.from("order_items").delete().eq("order_id", saved.id);
    const { error: itemsError } = await admin.from("order_items").insert(
      order.items.map((item, index) => ({
        order_id: saved.id,
        name: item.name,
        unit: item.unit ?? "шт",
        quantity: item.quantity,
        price: item.price,
        position: index,
      })),
    );

    if (itemsError) {
      results.push({
        external_1c_id: order.external_1c_id,
        ok: false,
        error: itemsError.message,
      });
      continue;
    }

    await admin.rpc("recalc_order_totals", { p_order_id: saved.id });
    results.push({ external_1c_id: order.external_1c_id, ok: true });
  }

  const failed = results.filter((r) => !r.ok);
  await logSync(admin, {
    direction: "in",
    entity: "order",
    status: failed.length ? "error" : "ok",
    message: `Принято заказов: ${results.length - failed.length}, с ошибками: ${failed.length}`,
    payload: failed.length ? failed : null,
  });

  return NextResponse.json({ results });
}
