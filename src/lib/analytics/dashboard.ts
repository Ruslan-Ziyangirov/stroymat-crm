import type { OrderSlice } from "@/lib/queries/stats";
import type { OrderStatus } from "@/lib/types";

function monthBounds(monthsBack: number) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + 1, 1));
  return { start, end };
}

export interface RankRow {
  id: string;
  name: string;
  amount: number;
  orders: number;
  avgCheck: number;
  /** % к прошлому месяцу. null — нет данных за прошлый месяц. */
  growth: number | null;
}

function rankByKey(
  orders: OrderSlice[],
  keyOf: (o: OrderSlice) => string | null,
  names: Map<string, string>,
  fallbackName: string,
): RankRow[] {
  const { start: curStart, end: curEnd } = monthBounds(0);
  const { start: prevStart, end: prevEnd } = monthBounds(1);

  const cur = new Map<string, { amount: number; orders: number }>();
  const prev = new Map<string, { amount: number; orders: number }>();

  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const key = keyOf(o) ?? "none";
    const date = new Date(o.created_at);
    const bucket =
      date >= curStart && date < curEnd ? cur : date >= prevStart && date < prevEnd ? prev : null;
    if (!bucket) continue;
    const b = bucket.get(key) ?? { amount: 0, orders: 0 };
    b.amount += Number(o.total ?? 0);
    b.orders += 1;
    bucket.set(key, b);
  }

  return [...cur.entries()]
    .map(([id, v]) => {
      const p = prev.get(id);
      const growth = p && p.amount ? ((v.amount - p.amount) / p.amount) * 100 : null;
      return {
        id,
        name: names.get(id) ?? fallbackName,
        amount: Math.round(v.amount * 100) / 100,
        orders: v.orders,
        avgCheck: v.orders ? Math.round((v.amount / v.orders) * 100) / 100 : 0,
        growth,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Рейтинг магазинов за текущий месяц с динамикой к прошлому. */
export function storeRanking(orders: OrderSlice[], stores: { id: string; name: string }[]): RankRow[] {
  const names = new Map(stores.map((s) => [s.id, s.name]));
  return rankByKey(orders, (o) => o.store_id, names, "Без магазина");
}

/** Рейтинг менеджеров за текущий месяц с динамикой к прошлому. */
export function managerRanking(
  orders: OrderSlice[],
  managers: { id: string; full_name: string }[],
): RankRow[] {
  const names = new Map(managers.map((m) => [m.id, m.full_name]));
  return rankByKey(orders, (o) => o.manager_id, names, "Без менеджера").filter((r) => r.id !== "none");
}

export interface FunnelResult {
  created: number;
  paid: number;
  completed: number;
  /** % заказов, дошедших минимум до оплаты. */
  paidRate: number | null;
  /** % заказов, дошедших до завершения. */
  completedRate: number | null;
}

const REACHED_PAID: OrderStatus[] = ["paid", "shipping", "completed"];

/** Воронка «оформлен → оплачен → завершён» за текущий месяц. */
export function orderFunnel(orders: OrderSlice[]): FunnelResult {
  const { start, end } = monthBounds(0);
  const active = orders.filter((o) => {
    if (o.status === "cancelled") return false;
    const d = new Date(o.created_at);
    return d >= start && d < end;
  });
  const created = active.length;
  const paid = active.filter((o) => REACHED_PAID.includes(o.status)).length;
  const completed = active.filter((o) => o.status === "completed").length;
  return {
    created,
    paid,
    completed,
    paidRate: created ? (paid / created) * 100 : null,
    completedRate: created ? (completed / created) * 100 : null,
  };
}

interface ClientOrderStat {
  ordersCount: number;
  lastOrderAt: string;
}

function clientOrderStats(orders: OrderSlice[]): Map<string, ClientOrderStat> {
  const map = new Map<string, ClientOrderStat>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const s = map.get(o.client_id);
    if (!s) {
      map.set(o.client_id, { ordersCount: 1, lastOrderAt: o.created_at });
    } else {
      s.ordersCount += 1;
      if (o.created_at > s.lastOrderAt) s.lastOrderAt = o.created_at;
    }
  }
  return map;
}

/** Новые (первый заказ в этом месяце) и повторные клиенты за текущий месяц. */
export function newVsReturning(
  orders: OrderSlice[],
  clientCreatedAt: Map<string, string>,
): { newCount: number; returningCount: number } {
  const { start, end } = monthBounds(0);
  const clientsThisMonth = new Set<string>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const d = new Date(o.created_at);
    if (d >= start && d < end) clientsThisMonth.add(o.client_id);
  }

  let newCount = 0;
  let returningCount = 0;
  for (const id of clientsThisMonth) {
    const createdAt = clientCreatedAt.get(id);
    if (createdAt && new Date(createdAt) >= start) newCount += 1;
    else returningCount += 1;
  }
  return { newCount, returningCount };
}

export interface ChurnRow {
  clientId: string;
  ordersCount: number;
  lastOrderAt: string;
}

/**
 * Клиенты с 2+ заказами, которые не заказывали последние `staleDays` дней —
 * раньше покупали регулярно, а сейчас затихли.
 */
export function churnCandidates(orders: OrderSlice[], staleDays = 60, limit = 8): ChurnRow[] {
  const stats = clientOrderStats(orders);
  const now = Date.now();
  const rows: ChurnRow[] = [];
  for (const [clientId, s] of stats.entries()) {
    if (s.ordersCount < 2) continue;
    const daysSince = (now - new Date(s.lastOrderAt).getTime()) / 86_400_000;
    if (daysSince >= staleDays) {
      rows.push({ clientId, ordersCount: s.ordersCount, lastOrderAt: s.lastOrderAt });
    }
  }
  return rows
    .sort((a, b) => new Date(a.lastOrderAt).getTime() - new Date(b.lastOrderAt).getTime())
    .slice(0, limit);
}
