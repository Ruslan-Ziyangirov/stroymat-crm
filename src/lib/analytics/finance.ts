import { formatMoney, formatMonth } from "@/lib/format";

export interface CashFlowMonthPoint {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

/** Сворачивает строки «Анализ счёта 51» в помесячный приток/отток денег. */
export function aggregateCashFlowByMonth(
  rows: { period_month: string; debit: number | null; credit: number | null }[],
): CashFlowMonthPoint[] {
  const map = new Map<string, { inflow: number; outflow: number }>();
  for (const row of rows) {
    const bucket = map.get(row.period_month) ?? { inflow: 0, outflow: 0 };
    bucket.inflow += row.debit ?? 0;
    bucket.outflow += row.credit ?? 0;
    map.set(row.period_month, bucket);
  }
  return [...map.entries()]
    .map(([month, v]) => ({
      month,
      inflow: Math.round(v.inflow * 100) / 100,
      outflow: Math.round(v.outflow * 100) / 100,
      net: Math.round((v.inflow - v.outflow) * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface CashFlowCategory {
  name: string;
  amount: number;
}

/** Разбивка притока или оттока денег по статьям (комментарий из 1С). */
export function cashFlowByCategory(
  rows: {
    comment: string | null;
    corr_account: string | null;
    debit: number | null;
    credit: number | null;
  }[],
  direction: "inflow" | "outflow",
): CashFlowCategory[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = direction === "inflow" ? row.debit : row.credit;
    if (!value) continue;
    const name = row.comment ?? row.corr_account ?? "Прочее";
    map.set(name, (map.get(name) ?? 0) + value);
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export interface StatementYearSummary {
  year: number;
  revenue: number | null;
  netProfit: number | null;
  equity: number | null;
  balanceTotal: number | null;
}

/** Годовая сводка по строкам баланса/ОФР — берёт первый заполненный код-алиас. */
export function summarizeStatementsByYear(
  lines: { period_year: number; code: string; value: number | null }[],
): StatementYearSummary[] {
  const byYear = new Map<number, Map<string, number | null>>();
  for (const line of lines) {
    const m = byYear.get(line.period_year) ?? new Map<string, number | null>();
    m.set(line.code, line.value);
    byYear.set(line.period_year, m);
  }

  const pick = (m: Map<string, number | null>, codes: string[]) => {
    for (const code of codes) {
      const v = m.get(code);
      if (v !== undefined && v !== null) return v;
    }
    return null;
  };

  return [...byYear.entries()]
    .map(([year, m]) => ({
      year,
      revenue: pick(m, ["2110"]),
      netProfit: pick(m, ["2400"]),
      equity: pick(m, ["1370", "1300"]),
      balanceTotal: pick(m, ["1600"]),
    }))
    .sort((a, b) => a.year - b.year);
}

/** Краткие автоматические выводы по финансовым данным для дашборда. */
export function buildFinanceInsights(
  cashFlow: CashFlowMonthPoint[],
  statements: StatementYearSummary[],
): string[] {
  const out: string[] = [];

  if (cashFlow.length) {
    const last = cashFlow[cashFlow.length - 1];
    out.push(
      `${formatMonth(last.month)}: приток ${formatMoney(last.inflow)}, отток ${formatMoney(
        last.outflow,
      )}, чистый поток ${last.net >= 0 ? "+" : ""}${formatMoney(last.net)}.`,
    );
  }

  if (statements.length) {
    const last = statements[statements.length - 1];
    const prev = statements.length > 1 ? statements[statements.length - 2] : null;
    // Баланс и ОФР приходят в тыс. руб. (ед. измерения формы) — переводим в рубли для единообразия с остальной CRM.
    if (last.revenue !== null) {
      let line = `Выручка за ${last.year} г. — ${formatMoney(last.revenue * 1000)}`;
      if (prev?.revenue) {
        const delta = ((last.revenue - prev.revenue) / prev.revenue) * 100;
        line += `, ${delta >= 0 ? "рост" : "падение"} на ${Math.abs(delta).toFixed(1).replace(".", ",")} % к ${prev.year} г.`;
      }
      out.push(line);
    }
    if (last.netProfit !== null) {
      out.push(`Чистая прибыль за ${last.year} г. — ${formatMoney(last.netProfit * 1000)}.`);
    }
  }

  return out;
}
