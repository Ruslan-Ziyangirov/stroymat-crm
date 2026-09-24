import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { ClientCards, type ClientCardRow } from "@/components/clients/client-cards";
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
      .select("*, manager:profiles!clients_manager_id_fkey(id, full_name), store:stores(id, name)")
      .order("created_at", { ascending: false }),
    supabase.from("orders").select("client_id, total, stage"),
  ]);

  const clients = (clientsRes.data ?? []) as unknown as Client[];
  const orders = (ordersRes.data ?? []) as { client_id: string; total: number; stage: string }[];

  const totals = new Map<string, { count: number; sum: number }>();
  for (const order of orders) {
    if (order.stage === "closed_lost") continue;
    const bucket = totals.get(order.client_id) ?? { count: 0, sum: 0 };
    bucket.count += 1;
    bucket.sum += Number(order.total ?? 0);
    totals.set(order.client_id, bucket);
  }

  const rows: ClientCardRow[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    type: client.type,
    phone: client.phone,
    manager_name: client.manager?.full_name ?? null,
    store_name: client.store?.name ?? null,
    orders_count: totals.get(client.id)?.count ?? 0,
    orders_total: totals.get(client.id)?.sum ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Клиенты"
        description={`В базе ${clients.length} карточек.`}
        actions={
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="size-4" />
              Новый клиент
            </Link>
          </Button>
        }
      />
      <ClientCards data={rows} />
    </>
  );
}
