import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, disabledResponse, isSyncEnabled, logSync } from "@/lib/integration/api";

export const dynamic = "force-dynamic";

const incomingClient = z.object({
  external_1c_id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["individual", "company"]).optional(),
  inn: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  discount_percent: z.number().min(0).max(50).optional(),
  bonus_balance: z.number().optional(),
});

const payloadSchema = z.object({ clients: z.array(incomingClient).min(1) });

/** Выгрузка клиентов из CRM в 1С. */
export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!(await isSyncEnabled(admin, "sync_clients"))) return disabledResponse();

  const since = new URL(request.url).searchParams.get("since");

  let query = admin
    .from("clients")
    .select(
      "id, external_1c_id, name, type, inn, phone, email, address, discount_percent, bonus_balance, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (since) query = query.gte("updated_at", since);

  const { data, error } = await query;

  if (error) {
    await logSync(admin, {
      direction: "out",
      entity: "client",
      status: "error",
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSync(admin, {
    direction: "out",
    entity: "client",
    status: "ok",
    message: `Отдано клиентов: ${data?.length ?? 0}`,
  });

  return NextResponse.json({ clients: data ?? [] });
}

/** Загрузка клиентов из 1С в CRM (upsert по external_1c_id). */
export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  const admin = createAdminClient();
  if (!(await isSyncEnabled(admin, "sync_clients"))) return disabledResponse();

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

  const rows = parsed.data.clients.map((client) => ({
    external_1c_id: client.external_1c_id,
    name: client.name,
    type: client.type ?? "company",
    inn: client.inn ?? null,
    phone: client.phone ?? null,
    email: client.email ?? null,
    address: client.address ?? null,
    discount_percent: client.discount_percent ?? 0,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await admin
    .from("clients")
    .upsert(rows, { onConflict: "external_1c_id" })
    .select("id, external_1c_id");

  if (error) {
    await logSync(admin, {
      direction: "in",
      entity: "client",
      status: "error",
      message: error.message,
      payload: body,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logSync(admin, {
    direction: "in",
    entity: "client",
    status: "ok",
    message: `Принято клиентов: ${data?.length ?? 0}`,
  });

  return NextResponse.json({ synced: data?.length ?? 0, clients: data ?? [] });
}
