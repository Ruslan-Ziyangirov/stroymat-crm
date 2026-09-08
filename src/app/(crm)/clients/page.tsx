import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { ClientsTable, type ClientRow } from "@/components/clients/clients-table";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Клиенты" };

export default async function ClientsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [clientsRes, ordersRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*, manager:profiles(id, full_name), store:stores(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("client_id, total, status"),
  ]);

  const clients = (clientsRes.data ?? []) as unknown as Client[];
  const orders = (ordersRes.data ?? []) as {
    client_id: string;
    total: number;
    status: string;
  }[];

  const totals = new Map<string, { count: number; sum: number }>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const bucket = totals.get(order.client_id) ?? { count: 0, sum: 0 };
    bucket.count += 1;
    bucket.sum += Number(order.total ?? 0);
    totals.set(order.client_id, bucket);
  }

  const rows: ClientRow[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    type: client.type,
    status: client.status,
    phone: client.phone,
    email: client.email,
    manager: client.manager?.full_name ?? "Не назначен",
    store: client.store?.name ?? "—",
    bonus_balance: Number(client.bonus_balance ?? 0),
    orders_count: totals.get(client.id)?.count ?? 0,
    orders_total: totals.get(client.id)?.sum ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Клиенты"
        description={`В базе ${clients.length} карточек. Нажмите на строку, чтобы открыть карточку клиента.`}
        actions={
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="size-4" />
              Новый клиент
            </Link>
          </Button>
        }
      />
      <ClientsTable data={rows} />
    </>
  );
}
