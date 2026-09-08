import type { DistrictInputs, DistrictScores } from "@/lib/types";

/** Вес каждого критерия в итоговой оценке (сумма = 1). */
export const DISTRICT_WEIGHTS: Record<keyof DistrictScores, number> = {
  competition: 0.18,
  pricing: 0.1,
  housing: 0.16,
  construction: 0.16,
  infrastructure: 0.1,
  demand: 0.16,
  prospects: 0.09,
  economics: 0.05,
};

export const DISTRICT_CRITERIA_LABELS: Record<keyof DistrictScores, string> = {
  competition: "Конкуренция",
  pricing: "Уровень цен",
  housing: "Жилая застройка",
  construction: "Новые стройки",
  infrastructure: "Инфраструктура",
  demand: "Потенциальный спрос",
  prospects: "Перспективы района",
  economics: "Экономика точки",
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** 1..5 → 0..100 */
const scale5 = (n: number) => clamp(((n - 1) / 4) * 100);

/**
 * Считает балл 0–100 по каждому критерию на основе данных,
 * которые руководитель заполнил по району.
 */
export function scoreDistrict(input: DistrictInputs): DistrictScores {
  // Чем больше и сильнее конкурентов — тем ниже балл.
  const competitionRaw = input.competitors * (0.6 + input.competitorStrength * 0.2);
  const competition = clamp(100 - competitionRaw * 9);

  // Средний уровень цен в районе выгоднее низкого демпинга и премиум-сегмента.
  const pricing = clamp(100 - Math.abs(input.priceLevel - 3.5) * 26);

  // Жилой фонд: 10 000 квартир и больше — максимум.
  const housing = clamp((input.residentialUnits / 10000) * 100);

  // Активные стройки: 12 объектов и больше — максимум.
  const construction = clamp((input.newConstructions / 12) * 100);

  const infrastructure = scale5(input.infrastructure);
  const demand = scale5(input.demand);
  const prospects = scale5(input.prospects);

  // Экономика: аренда до 300 тыс./мес. и хорошая логистика.
  const rentScore = clamp(100 - (input.rentCost / 300000) * 100);
  const economics = clamp(rentScore * 0.6 + scale5(input.logistics) * 0.4);

  return {
    competition: Math.round(competition),
    pricing: Math.round(pricing),
    housing: Math.round(housing),
    construction: Math.round(construction),
    infrastructure: Math.round(infrastructure),
    demand: Math.round(demand),
    prospects: Math.round(prospects),
    economics: Math.round(economics),
  };
}

export function totalScore(scores: DistrictScores): number {
  const sum = (Object.keys(DISTRICT_WEIGHTS) as (keyof DistrictScores)[]).reduce(
    (acc, key) => acc + scores[key] * DISTRICT_WEIGHTS[key],
    0,
  );
  return Math.round(sum * 10) / 10;
}

export function verdictFor(score: number): { verdict: string; tone: "good" | "mid" | "bad" } {
  if (score >= 70) return { verdict: "Высокий потенциал — открывать выгодно", tone: "good" };
  if (score >= 50) return { verdict: "Средний потенциал — открывать с осторожностью", tone: "mid" };
  return { verdict: "Низкий потенциал — открывать невыгодно", tone: "bad" };
}

/** Текстовое объяснение оценки: сильные и слабые стороны района. */
export function explainDistrict(
  input: DistrictInputs,
  scores: DistrictScores,
  total: number,
): string {
  const entries = (Object.keys(scores) as (keyof DistrictScores)[]).map((key) => ({
    key,
    label: DISTRICT_CRITERIA_LABELS[key],
    value: scores[key],
  }));
  const strong = entries.filter((e) => e.value >= 65).sort((a, b) => b.value - a.value);
  const weak = entries.filter((e) => e.value < 45).sort((a, b) => a.value - b.value);

  const parts: string[] = [];
  parts.push(`Итоговая оценка района — ${total} из 100. ${verdictFor(total).verdict}.`);

  if (strong.length) {
    parts.push(
      `Сильные стороны: ${strong
        .slice(0, 3)
        .map((e) => `${e.label.toLowerCase()} (${e.value})`)
        .join(", ")}.`,
    );
  }
  if (weak.length) {
    parts.push(
      `Слабые стороны: ${weak
        .slice(0, 3)
        .map((e) => `${e.label.toLowerCase()} (${e.value})`)
        .join(", ")}.`,
    );
  }

  if (input.competitors === 0) {
    parts.push("Прямых конкурентов в районе не заявлено — есть шанс занять рынок первым.");
  } else if (scores.competition < 40) {
    parts.push(
      `Конкуренция высокая: ${input.competitors} игрок(ов). Потребуется отстройка по ассортименту, доставке или цене.`,
    );
  }

  if (input.newConstructions >= 5) {
    parts.push(
      `${input.newConstructions} активных строек рядом дают стабильный поток закупок на 1–3 года.`,
    );
  } else if (input.newConstructions === 0) {
    parts.push("Новых строек нет — спрос будет держаться в основном на ремонте и частном секторе.");
  }

  if (scores.economics < 45) {
    parts.push("Экономика точки напряжённая: высокая аренда или сложная логистика снижают маржу.");
  }

  return parts.join(" ");
}

export function recommendationFor(
  input: DistrictInputs,
  scores: DistrictScores,
  total: number,
): string {
  if (total >= 70) {
    return "Рекомендуем открывать магазин полного формата. Заложите повышенный сток по сухим смесям и кирпичу под стройки района.";
  }
  if (total >= 50) {
    return input.newConstructions >= 4
      ? "Рекомендуем стартовать с компактного формата (пункт выдачи + склад под заказ) и расширяться по мере роста строек."
      : "Рекомендуем протестировать район пунктом выдачи с доставкой из ближайшего магазина, прежде чем открывать полноформатную точку.";
  }
  return "Открытие в текущих условиях не окупится. Стоит рассмотреть соседние районы либо вернуться к оценке после ввода новых жилых комплексов.";
}

export const EMPTY_DISTRICT_INPUTS: DistrictInputs = {
  competitors: 0,
  competitorStrength: 3,
  priceLevel: 3,
  residentialUnits: 0,
  newConstructions: 0,
  infrastructure: 3,
  demand: 3,
  prospects: 3,
  rentCost: 0,
  logistics: 3,
};
