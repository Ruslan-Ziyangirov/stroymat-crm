import type { DistrictInputs, DistrictScores } from "@/lib/types";

/** Вес каждого критерия в итоговой оценке (сумма = 1). */
export const DISTRICT_WEIGHTS: Record<keyof DistrictScores, number> = {
  population: 0.25,
  competitors: 0.25,
  accessibility: 0.15,
  ownStoreNearby: 0.15,
  buildingType: 0.1,
  rent: 0.1,
};

export const DISTRICT_CRITERIA_LABELS: Record<keyof DistrictScores, string> = {
  population: "Население зоны охвата",
  competitors: "Конкуренты в доступности",
  accessibility: "Доступность точки",
  ownStoreNearby: "Близость своего магазина",
  buildingType: "Тип застройки",
  rent: "Аренда помещения",
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Нейтральный балл для критерия, по которому данных нет (не топит и не тянет вверх). */
const UNKNOWN_SCORE = 50;

/** Линейная интерполяция по опорным точкам [значение, балл], с насыщением по краям. */
function interpolate(value: number, points: [number, number][]): number {
  if (value <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return last[1];
}

const POPULATION_CURVE: [number, number][] = [
  [0, 15],
  [3000, 25],
  [10000, 50],
  [30000, 72],
  [70000, 90],
  [150000, 100],
];

function populationScore(population: number | undefined): number {
  if (population == null) return UNKNOWN_SCORE;
  return clamp(interpolate(population, POPULATION_CURVE));
}

// Насыщение рынка растёт быстро на первых конкурентах и дальше выполаживается —
// разница между 20 и 40 конкурентами для рынка уже не так важна, как между 0 и 3.
const COMPETITOR_COUNT_CURVE: [number, number][] = [
  [0, 100],
  [1, 80],
  [3, 55],
  [6, 35],
  [12, 20],
  [30, 8],
];

function competitorsScore(count: number, strong: number): number {
  const base = interpolate(count, COMPETITOR_COUNT_CURVE);
  // Важна не абсолютная цифра «сильных», а их доля среди всех конкурентов —
  // иначе 2 сильных сети из 3 игроков и 2 сильных сети из 50 бьют по баллу одинаково.
  const strongShare = count > 0 ? clamp(strong, 0, count) / count : 0;
  const penalty = strongShare * 40;
  return clamp(base - penalty);
}

function accessibilityScore(value: DistrictInputs["accessibility"]): number {
  if (value === "yes") return 100;
  if (value === "partial") return 55;
  return 10;
}

function ownStoreNearbyScore(value: DistrictInputs["ownStoreNearby"]): number {
  return value === "yes" ? 25 : 100;
}

function buildingTypeScore(value: DistrictInputs["buildingType"]): number {
  if (value === "mixed") return 100;
  if (value === "private") return 85;
  return 55;
}

const RENT_TIERS: [number, number][] = [
  [60000, 100],
  [120000, 75],
  [200000, 50],
  [300000, 25],
];

function rentScore(rentCost: number | undefined): number {
  if (rentCost == null) return UNKNOWN_SCORE;
  for (const [limit, score] of RENT_TIERS) {
    if (rentCost <= limit) return score;
  }
  return 10;
}

/**
 * Считает балл 0–100 по каждому из 6 критериев на основе данных,
 * которые руководитель заполнил по зоне охвата.
 */
export function scoreDistrict(input: DistrictInputs): DistrictScores {
  return {
    population: Math.round(populationScore(input.population)),
    competitors: Math.round(competitorsScore(input.competitorsCount, input.strongCompetitors)),
    accessibility: Math.round(accessibilityScore(input.accessibility)),
    ownStoreNearby: Math.round(ownStoreNearbyScore(input.ownStoreNearby)),
    buildingType: Math.round(buildingTypeScore(input.buildingType)),
    rent: Math.round(rentScore(input.rentCost)),
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

/** Какие необязательные критерии оставлены пустыми — балл по ним усреднён, а не занижен. */
export function missingDistrictInputs(input: DistrictInputs): string[] {
  const missing: string[] = [];
  if (input.population == null) missing.push("Население зоны охвата");
  if (input.rentCost == null) missing.push("Аренда помещения");
  return missing;
}

/** Текстовое объяснение оценки: сильные и слабые стороны зоны. */
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
  const strong = entries.filter((e) => e.value >= 70).sort((a, b) => b.value - a.value);
  const weak = entries.filter((e) => e.value < 45).sort((a, b) => a.value - b.value);

  const parts: string[] = [];
  parts.push(`Итоговая оценка зоны — ${total} из 100. ${verdictFor(total).verdict}.`);

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

  const missing = missingDistrictInputs(input);
  if (missing.length) {
    parts.push(
      `Не указано: ${missing.join(", ").toLowerCase()} — балл по этим критериям усреднён, для точности стоит уточнить данные.`,
    );
  }

  if (input.competitorsCount === 0) {
    parts.push("Прямых конкурентов в зоне доступности не заявлено — есть шанс занять рынок первым.");
  } else if (input.strongCompetitors >= 1) {
    parts.push(
      `Среди конкурентов есть ${input.strongCompetitors} сильн${input.strongCompetitors === 1 ? "ый" : "ых"} игрок(ов) — потребуется отстройка по ассортименту, доставке или цене.`,
    );
  }

  if (input.ownStoreNearby === "yes") {
    parts.push(
      "В той же зоне доступности уже есть своя точка — велик риск, что новый магазин просто перетянет часть спроса, а не добавит новый.",
    );
  }

  return parts.join(" ");
}

export function recommendationFor(
  input: DistrictInputs,
  scores: DistrictScores,
  total: number,
): string {
  if (total >= 70) {
    return "Рекомендуем открывать магазин полного формата — зона сильная по большинству критериев.";
  }
  if (total >= 50) {
    if (scores.competitors < 45) {
      return "Рекомендуем протестировать зону компактным форматом (пункт выдачи под заказ), прежде чем открывать полноформатную точку — конкуренция ощутимая.";
    }
    return "Открываться можно, но стоит заранее договориться по условиям аренды и проверить логистику подъезда — часть показателей средние.";
  }
  return "Открытие в текущих условиях рискованно. Стоит рассмотреть соседние зоны либо вернуться к оценке после уточнения данных.";
}

export const EMPTY_DISTRICT_INPUTS: DistrictInputs = {
  population: undefined,
  buildingType: "mixed",
  competitorsCount: 0,
  strongCompetitors: 0,
  accessibility: "yes",
  rentCost: undefined,
  ownStoreNearby: "no",
};
