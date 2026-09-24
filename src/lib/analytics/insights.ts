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
