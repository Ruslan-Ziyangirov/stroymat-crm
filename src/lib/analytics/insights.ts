import { formatMoney, formatMonth, formatNumber } from "@/lib/format";

export interface PeriodPoint {
  month: string;
  orders: number;
  amount: number;
  clients: number;
  avgCheck: number;
}

export interface PeriodComparison {
  current: PeriodPoint;
  previous: PeriodPoint | null;
  deltaAmount: number | null;
  deltaOrders: number | null;
  deltaAvgCheck: number | null;
  deltaClients: number | null;
}

function pct(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function comparePeriods(points: PeriodPoint[]): PeriodComparison | null {
  if (!points.length) return null;
  const current = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : null;

  return {
    current,
    previous,
    deltaAmount: previous ? pct(current.amount, previous.amount) : null,
    deltaOrders: previous ? pct(current.orders, previous.orders) : null,
    deltaAvgCheck: previous ? pct(current.avgCheck, previous.avgCheck) : null,
    deltaClients: previous ? pct(current.clients, previous.clients) : null,
  };
}

const trend = (value: number | null) =>
  value === null ? "без сопоставимого периода" : value >= 0 ? "рост" : "падение";

const abs = (value: number) => `${Math.abs(value).toFixed(1).replace(".", ",")} %`;

/**
 * Краткие автоматические выводы по помесячной динамике.
 * Возвращает список готовых предложений для блока «Выводы».
 */
export function buildMonthlyInsights(points: PeriodPoint[]): string[] {
  if (!points.length) return ["Недостаточно данных для выводов — за выбранный период нет заказов."];

  const cmp = comparePeriods(points)!;
  const { current, previous } = cmp;
  const out: string[] = [];

  out.push(
    `За ${formatMonth(current.month)} оформлено ${formatNumber(current.orders)} заказов на ${formatMoney(
      current.amount,
    )}.`,
  );

  if (previous && cmp.deltaAmount !== null) {
    out.push(
      `По сумме — ${trend(cmp.deltaAmount)} на ${abs(cmp.deltaAmount)} к ${formatMonth(
        previous.month,
      )} (${formatMoney(previous.amount)}).`,
    );
  }

  if (cmp.deltaOrders !== null && Math.abs(cmp.deltaOrders) >= 1) {
    out.push(`Количество заказов: ${trend(cmp.deltaOrders)} на ${abs(cmp.deltaOrders)}.`);
  }

  if (cmp.deltaAvgCheck !== null && Math.abs(cmp.deltaAvgCheck) >= 3) {
    out.push(
      `Средний чек ${cmp.deltaAvgCheck >= 0 ? "вырос" : "снизился"} на ${abs(
        cmp.deltaAvgCheck,
      )} и составил ${formatMoney(current.avgCheck)}.`,
    );
  }

  // Средняя выручка за предыдущие месяцы — ловим отклонения от нормы.
  const history = points.slice(0, -1);
  if (history.length >= 2) {
    const avg = history.reduce((s, p) => s + p.amount, 0) / history.length;
    const deviation = pct(current.amount, avg);
    if (deviation !== null && Math.abs(deviation) >= 15) {
      out.push(
        `Отклонение от среднемесячного уровня (${formatMoney(avg)}) составляет ${
          deviation >= 0 ? "+" : "−"
        }${abs(deviation)} — стоит разобрать причины.`,
      );
    }
  }

  const best = [...points].sort((a, b) => b.amount - a.amount)[0];
  if (best && best.month !== current.month) {
    out.push(
      `Лучший месяц периода — ${formatMonth(best.month)} (${formatMoney(best.amount)}).`,
    );
  }

  if (points.length >= 3) {
    const last3 = points.slice(-3);
    const rising = last3.every((p, i) => i === 0 || p.amount >= last3[i - 1].amount);
    const falling = last3.every((p, i) => i === 0 || p.amount <= last3[i - 1].amount);
    if (rising) out.push("Выручка растёт третий месяц подряд — динамика устойчиво положительная.");
    if (falling) out.push("Выручка снижается третий месяц подряд — требуется план по возврату спроса.");
  }

  return out;
}

export interface UploadAggregate {
  months: { month: string; amount: number; rows: number }[];
  topProducts: { name: string; amount: number; quantity: number }[];
  topClients: { name: string; amount: number }[];
  totalAmount: number;
  rowsCount: number;
}

/** Выводы по загруженному внешнему отчёту. */
export function buildUploadInsights(agg: UploadAggregate): string[] {
  const out: string[] = [];
  out.push(
    `Распознано ${formatNumber(agg.rowsCount)} строк на общую сумму ${formatMoney(agg.totalAmount)}.`,
  );

  if (agg.months.length >= 2) {
    const sorted = [...agg.months].sort((a, b) => a.month.localeCompare(b.month));
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const delta = pct(last.amount, prev.amount);
    if (delta !== null) {
      out.push(
        `${formatMonth(last.month)} к ${formatMonth(prev.month)}: ${
          delta >= 0 ? "рост" : "падение"
        } на ${abs(delta)} (${formatMoney(last.amount)} против ${formatMoney(prev.amount)}).`,
      );
    }

    const amounts = sorted.map((m) => m.amount);
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const anomalies = sorted.filter((m) => Math.abs(m.amount - avg) / (avg || 1) > 0.3);
    if (anomalies.length) {
      out.push(
        `Отклонения от среднего уровня: ${anomalies
          .map((m) => `${formatMonth(m.month)} (${formatMoney(m.amount)})`)
          .join(", ")}.`,
      );
    }
  }

  if (agg.topProducts.length) {
    const top = agg.topProducts[0];
    const share = agg.totalAmount ? (top.amount / agg.totalAmount) * 100 : 0;
    out.push(
      `Лидер продаж — «${top.name}»: ${formatMoney(top.amount)} (${share
        .toFixed(1)
        .replace(".", ",")} % оборота).`,
    );
  }

  if (agg.topClients.length >= 3) {
    const top3 = agg.topClients.slice(0, 3).reduce((s, c) => s + c.amount, 0);
    const share = agg.totalAmount ? (top3 / agg.totalAmount) * 100 : 0;
    if (share >= 40) {
      out.push(
        `Топ-3 клиента дают ${share.toFixed(0)} % оборота — высокая зависимость от нескольких покупателей.`,
      );
    }
  }

  return out;
}

/** Свод по строкам загруженного отчёта. */
export function aggregateRows(
  rows: { period_month: string | null; product_name: string | null; client_name: string | null; quantity: number | null; amount: number | null }[],
): UploadAggregate {
  const months = new Map<string, { amount: number; rows: number }>();
  const products = new Map<string, { amount: number; quantity: number }>();
  const clients = new Map<string, number>();
  let totalAmount = 0;

  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    totalAmount += amount;

    if (row.period_month) {
      const m = months.get(row.period_month) ?? { amount: 0, rows: 0 };
      m.amount += amount;
      m.rows += 1;
      months.set(row.period_month, m);
    }
    if (row.product_name) {
      const p = products.get(row.product_name) ?? { amount: 0, quantity: 0 };
      p.amount += amount;
      p.quantity += Number(row.quantity ?? 0);
      products.set(row.product_name, p);
    }
    if (row.client_name) {
      clients.set(row.client_name, (clients.get(row.client_name) ?? 0) + amount);
    }
  }

  return {
    months: [...months.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topProducts: [...products.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    topClients: [...clients.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    totalAmount: Math.round(totalAmount * 100) / 100,
    rowsCount: rows.length,
  };
}
