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

// Комментарий в 1С — это свободный текст, который бухгалтер печатает руками
// в каждой выгрузке: за разные месяцы одна и та же операция получает разные
// формулировки и опечатки («Оплата поставщикам» / «Олата поставщикам» /
// «Оплата постащикам»), и на графике это выглядит как десяток разных статей.
// Корр. счёт (60, 62, 67...) при этом всегда один и тот же, поэтому статью
// определяем по счёту — так операции с одним экономическим смыслом всегда
// сворачиваются в одну строку. Порядок важен: более узкие префиксы (76.07)
// должны проверяться раньше общих (76).
const ACCOUNT_CATEGORIES: { prefix: string; label: string }[] = [
  { prefix: "60", label: "Поставщики" },
  { prefix: "62", label: "Покупатели" },
  { prefix: "57.01", label: "Взносы наличными на счёт" },
  { prefix: "57.03", label: "Поступления по эквайрингу" },
  { prefix: "57", label: "Переводы в пути" },
  { prefix: "76.07", label: "Лизинговые платежи" },
  { prefix: "76.41", label: "Алименты и исполнительные листы" },
  { prefix: "76", label: "Прочие расчёты с контрагентами" },
  { prefix: "67", label: "Кредиты и займы банков" },
  { prefix: "58", label: "Займы связанным сторонам" },
  { prefix: "68", label: "Налоги" },
  { prefix: "69", label: "Страховые взносы" },
  { prefix: "70", label: "Зарплата" },
  { prefix: "71", label: "Подотчётные суммы" },
  { prefix: "75", label: "Взносы в уставный капитал" },
  { prefix: "91", label: "Банковские услуги и проценты" },
  { prefix: "99", label: "Штрафы и пени" },
  { prefix: "44", label: "Транспортные сборы" },
];

// Иногда в выгрузке у строки не заполнен корр. счёт (пустая ячейка в 1С) —
// такое случается редко, но встречается. В этом случае подбираем статью по
// ключевым словам в комментарии, чтобы не показывать сырой текст отдельной
// строкой на графике.
const KEYWORD_CATEGORIES: { pattern: RegExp; label: string }[] = [
  { pattern: /займ|кредит/i, label: "Кредиты и займы банков" },
  { pattern: /госпошлин|банк/i, label: "Банковские услуги и проценты" },
];

function cashFlowCategoryLabel(corrAccount: string | null, comment: string | null): string {
  if (corrAccount) {
    const match = ACCOUNT_CATEGORIES.find(
      (c) => corrAccount === c.prefix || corrAccount.startsWith(`${c.prefix}.`),
    );
    if (match) return match.label;
  }
  if (comment) {
    const keywordMatch = KEYWORD_CATEGORIES.find((k) => k.pattern.test(comment));
    if (keywordMatch) return keywordMatch.label;
  }
  // Счёт не из справочника выше (редкий/новый) — показываем как есть,
  // чтобы не потерять сумму молча.
  return comment ?? corrAccount ?? "Прочее";
}

/** Разбивка притока или оттока денег по укрупнённым статьям (см. ACCOUNT_CATEGORIES). */
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
    const name = cashFlowCategoryLabel(row.corr_account, row.comment);
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

export interface FinanceRecommendation {
  text: string;
  /** positive — что идёт хорошо; risk — на что обратить внимание; action — что сделать дальше. */
  tone: "positive" | "risk" | "action";
}

const RU_MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const pct = (value: number) => `${Math.abs(value).toFixed(1).replace(".", ",")} %`;

/**
 * Рекомендации руководителю: не факты («выручка X ₽»), а плюсы, минусы и что
 * делать дальше — построено на пороговых правилах поверх уже посчитанных
 * cashFlow/statements, без обращения к каким-либо ИИ-сервисам.
 */
export function buildFinanceRecommendations(
  cashFlow: CashFlowMonthPoint[],
  statements: StatementYearSummary[],
  outflowByCategory: CashFlowCategory[],
): FinanceRecommendation[] {
  const out: FinanceRecommendation[] = [];

  // --- Выручка и маржа за последний доступный год -----------------------
  if (statements.length >= 2) {
    const last = statements[statements.length - 1];
    const prev = statements[statements.length - 2];

    let revenueGrowth: number | null = null;
    if (last.revenue !== null && prev.revenue) {
      revenueGrowth = ((last.revenue - prev.revenue) / prev.revenue) * 100;
      if (revenueGrowth >= 5) {
        out.push({
          tone: "positive",
          text: `Выручка за ${last.year} г. выросла на ${pct(revenueGrowth)} к ${prev.year} г. — рост уверенный.`,
        });
      } else if (revenueGrowth < 0) {
        out.push({
          tone: "risk",
          text: `Выручка за ${last.year} г. снизилась на ${pct(revenueGrowth)} к ${prev.year} г. — стоит разобраться в причине: рынок, конкуренты, ассортимент.`,
        });
      }
    }

    if (revenueGrowth !== null && revenueGrowth > 0 && last.netProfit !== null && prev.netProfit) {
      const profitGrowth = ((last.netProfit - prev.netProfit) / prev.netProfit) * 100;
      if (profitGrowth < revenueGrowth - 10) {
        out.push({
          tone: "risk",
          text: `Выручка выросла на ${pct(revenueGrowth)}, а чистая прибыль — ${profitGrowth >= 0 ? `только на ${pct(profitGrowth)}` : `снизилась на ${pct(profitGrowth)}`} — издержки растут быстрее продаж. Стоит проверить закупочные цены и постоянные расходы, прежде чем расширяться дальше.`,
        });
      } else {
        out.push({
          tone: "positive",
          text: `Прибыль растёт вместе с выручкой (+${pct(profitGrowth)} при +${pct(revenueGrowth)} выручки) — рост здоровый, маржа не проседает.`,
        });
        out.push({
          tone: "action",
          text: "Раз рост маржинальный — можно направить часть прибыли на развитие: новая точка, расширение ассортимента, найм.",
        });
      }
    }
  }

  // --- Денежный поток последнего месяца и серия -------------------------
  if (cashFlow.length) {
    const last = cashFlow[cashFlow.length - 1];
    if (last.net < 0) {
      out.push({
        tone: "risk",
        text: `${formatMonth(last.month)}: отток превысил приток на ${formatMoney(Math.abs(last.net))} — если это не разовая ситуация, стоит подстраховаться резервом или короткой кредитной линией.`,
      });
    } else {
      let streak = 0;
      for (let i = cashFlow.length - 1; i >= 0 && cashFlow[i].net >= 0; i--) streak++;
      if (streak >= 3) {
        const avg = cashFlow.slice(-streak).reduce((s, p) => s + p.net, 0) / streak;
        out.push({
          tone: "positive",
          text: `Последние ${streak} мес. подряд приток стабильно превышает отток (в среднем +${formatMoney(avg)}/мес) — хороший запас прочности.`,
        });
        out.push({
          tone: "action",
          text: "Свободный поток можно частично направить на развитие, не трогая оборотные средства.",
        });
      }
    }
  }

  // --- Концентрация оттока на одной статье -------------------------------
  if (outflowByCategory.length) {
    const total = outflowByCategory.reduce((s, c) => s + c.amount, 0);
    const top = outflowByCategory[0];
    const share = total ? (top.amount / total) * 100 : 0;
    if (share >= 50) {
      out.push({
        tone: "risk",
        text: `На статью «${top.name}» приходится ${pct(share)} всех списаний за период — можно попробовать пересмотреть условия оплаты, отсрочку или цены с этим контрагентом.`,
      });
    }
  }

  // --- Сезонность: месяц, который исторически проседает по деньгам -------
  if (cashFlow.length >= 15) {
    const byMonth = new Map<number, number[]>();
    for (const p of cashFlow) {
      const idx = new Date(p.month).getMonth();
      const arr = byMonth.get(idx) ?? [];
      arr.push(p.net);
      byMonth.set(idx, arr);
    }
    let worstIdx = -1;
    let worstAvg = 0;
    for (const [idx, values] of byMonth) {
      if (values.length < 2) continue; // нужно минимум 2 повторения, чтобы говорить о закономерности
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      if (avg < worstAvg) {
        worstAvg = avg;
        worstIdx = idx;
      }
    }
    if (worstIdx >= 0) {
      out.push({
        tone: "action",
        text: `${RU_MONTHS[worstIdx]} у вас исторически слабый по деньгам (в среднем ${formatMoney(worstAvg)} чистого потока) — стоит заранее откладывать резерв к этому периоду.`,
      });
    }
  }

  return out.slice(0, 6);
}
