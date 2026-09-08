import { createClient } from "@/lib/supabase/server";
import type { PeriodPoint } from "@/lib/analytics/insights";
import type { OrderStatus } from "@/lib/types";

export interface OrderSlice {
  id: string;
  created_at: string;
  total: number;
  client_id: string;
  store_id: string | null;
  manager_id: string | null;
  status: OrderStatus;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

/** Заказы за последние N месяцев — база для всей помесячной аналитики. */
export async function fetchOrderSlices(months = 12, storeId?: string) {
  const supabase = await createClient();
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - (months - 1), 1);
  from.setUTCHours(0, 0, 0, 0);

  let query = supabase
    .from("orders")
    .select("id, created_at, total, client_id, store_id, manager_id, status")
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: true });

  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderSlice[];
}

/**
 * Сворачивает заказы в помесячные показатели.
 * Отменённые заказы в выручку не попадают.
 */
export function toMonthlyPoints(orders: OrderSlice[], months = 12): PeriodPoint[] {
  const buckets = new Map<
    string,
    { orders: number; amount: number; clients: Set<string> }
  >();

  // Заполняем все месяцы периода, чтобы график не «проваливался».
  const cursor = new Date();
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setUTCMonth(d.getUTCMonth() - i);
    buckets.set(d.toISOString().slice(0, 10), {
      orders: 0,
      amount: 0,
      clients: new Set(),
    });
  }

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const key = monthKey(order.created_at);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.amount += Number(order.total ?? 0);
    bucket.clients.add(order.client_id);
  }

  return [...buckets.entries()].map(([month, b]) => ({
    month,
    orders: b.orders,
    amount: Math.round(b.amount * 100) / 100,
    clients: b.clients.size,
    avgCheck: b.orders ? Math.round((b.amount / b.orders) * 100) / 100 : 0,
  }));
}

/** Разрез выручки по магазинам за период. */
export function byStore(
  orders: OrderSlice[],
  stores: { id: string; name: string }[],
  monthsBack = 0,
) {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1),
  );
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 1));

  const map = new Map<string, { amount: number; orders: number }>();
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const date = new Date(order.created_at);
    if (monthsBack >= 0 && (date < start || date >= end)) continue;
    const key = order.store_id ?? "none";
    const bucket = map.get(key) ?? { amount: 0, orders: 0 };
    bucket.amount += Number(order.total ?? 0);
    bucket.orders += 1;
    map.set(key, bucket);
  }

  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      name: stores.find((s) => s.id === id)?.name ?? "Без магазина",
      ...v,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Распределение заказов по статусам. */
export function byStatus(orders: OrderSlice[]) {
  const map = new Map<OrderStatus, number>();
  for (const order of orders) {
    map.set(order.status, (map.get(order.status) ?? 0) + 1);
  }
  return map;
}
