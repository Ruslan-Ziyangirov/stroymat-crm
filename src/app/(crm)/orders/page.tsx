import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, List, Plus } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";
import { OrdersKanban } from "@/components/orders/orders-kanban";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

export const metadata: Metadata = { title: "Заказы" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireProfile();
  const { view } = await searchParams;
  const isBoard = view === "board";
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, number, status, total, created_at, client:clients(id, name), manager:profiles(id, full_name), store:stores(id, name), items:order_items(id)",
    )
    .order("created_at", { ascending: false });

  const orders = (data ?? []) as unknown as (Order & { items: { id: string }[] })[];

  const rows: OrderRow[] = orders.map((order) => ({
    id: order.id,
    number: order.number,
    client: order.client?.name ?? "—",
    manager: order.manager?.full_name ?? "Не назначен",
    store: order.store?.name ?? "—",
    status: order.status,
    total: Number(order.total ?? 0),
    created_at: order.created_at,
    items_count: order.items?.length ?? 0,
  }));

  const active = rows.filter(
    (row) => row.status !== "completed" && row.status !== "cancelled",
  );
  const activeSum = active.reduce((sum, row) => sum + row.total, 0);
  const completed = rows.filter((row) => row.status === "completed");

  return (
    <>
      <PageHeader
        title="Заказы"
        description="Все заказы компании: состав, сумма, ответственный менеджер и статус."
        actions={
          <>
            <div className="bg-muted flex items-center gap-1 rounded-full p-1">
              <Link
                href="/orders"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  !isBoard ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-4" />
                Список
              </Link>
              <Link
                href="/orders?view=board"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isBoard ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-4" />
                Канбан
              </Link>
            </div>
            <Button asChild>
              <Link href="/orders/new">
                <Plus className="size-4" />
                Новый заказ
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Всего заказов" value={formatNumber(rows.length)} />
        <StatCard
          label="В работе"
          value={formatNumber(active.length)}
          hint={`на ${formatMoney(activeSum)}`}
        />
        <StatCard
          label="Завершено"
          value={formatNumber(completed.length)}
          hint={`на ${formatMoney(completed.reduce((s, r) => s + r.total, 0))}`}
        />
      </div>

      {isBoard ? <OrdersKanban data={rows} /> : <OrdersTable data={rows} />}
    </>
  );
}
