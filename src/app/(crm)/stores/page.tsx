import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { StoresManager, type StoreRow } from "@/components/settings/stores-manager";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { Store } from "@/lib/types";

export const metadata: Metadata = { title: "Магазины" };

export default async function StoresPage() {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [storesRes, ordersRes] = await Promise.all([
    supabase.from("stores").select("*").order("name"),
    supabase.from("orders").select("store_id, total, status"),
  ]);

  const stores = (storesRes.data ?? []) as Store[];
  const orders = (ordersRes.data ?? []) as {
    store_id: string | null;
    total: number;
    status: string;
  }[];

  const totals = new Map<string, { count: number; sum: number }>();
  for (const order of orders) {
    if (!order.store_id || order.status === "cancelled") continue;
    const bucket = totals.get(order.store_id) ?? { count: 0, sum: 0 };
    bucket.count += 1;
    bucket.sum += Number(order.total ?? 0);
    totals.set(order.store_id, bucket);
  }

  const rows: StoreRow[] = stores.map((store) => ({
    id: store.id,
    name: store.name,
    code: store.code,
    city: store.city,
    address: store.address,
    phone: store.phone,
    is_active: store.is_active,
    orders_count: totals.get(store.id)?.count ?? 0,
    orders_total: totals.get(store.id)?.sum ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Магазины"
        description="Точки продаж компании. По ним строятся отчёты в разрезе магазинов."
      />
      <StoresManager data={rows} />
    </>
  );
}
