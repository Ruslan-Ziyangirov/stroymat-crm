import * as XLSX from "xlsx";
// pdf-parse's package.json main entry runs its debug demo when required directly
// in some setups — importing the lib file avoids that.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  data: Buffer,
) => Promise<{ text: string; numpages: number }>;

const MONTHS_RU: Record<string, number> = {
  "январь": 0,
  "февраль": 1,
  "март": 2,
  "апрель": 3,
  "май": 4,
  "июнь": 5,
  "июль": 6,
  "август": 7,
  "сентябрь": 8,
  "октябрь": 9,
  "ноябрь": 10,
  "декабрь": 11,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .replace(/[\s ]/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface CashFlowRow {
  corr_account: string | null;
  debit: number | null;
  credit: number | null;
  comment: string | null;
  raw: Record<string, unknown>;
}

export interface CashFlowParseResult {
  periodMonth: string;
  rows: CashFlowRow[];
  openingBalance: number | null;
  closingBalance: number | null;
  turnoverDebit: number | null;
  turnoverCredit: number | null;
}

/**
 * Разбирает выгрузку «Анализ счёта 51» из 1С (.xls/.xlsx) за один месяц.
 * Годовые своды («Анализ счёта 51 за 2024 г.») отклоняются — иначе месяцы
 * задвоятся в помесячной статистике.
 */
export function parseCashFlow51(buffer: ArrayBuffer): CashFlowParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("В файле нет листов с данными");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const titleRow = rows.find(
    (r) => typeof r[0] === "string" && /Анализ счета 51/i.test(r[0] as string),
  );
  const title = (titleRow?.[0] as string) ?? "";

  const monthMatch = title.match(
    /за\s+(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)\s+(\d{4})/i,
  );
  if (!monthMatch) {
    const yearOnly = title.match(/за\s+(\d{4})\s*г/i);
    if (yearOnly) {
      throw new Error(
        `Это годовой свод («${title.trim()}»), а не отчёт за месяц. Загрузите файлы по месяцам — иначе данные задвоятся.`,
      );
    }
    throw new Error(
      "Не удалось определить месяц отчёта. Проверьте, что это выгрузка «Анализ счёта 51» из 1С.",
    );
  }

  const monthIndex = MONTHS_RU[monthMatch[1].toLowerCase()];
  const year = Number(monthMatch[2]);
  const periodMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;

  // Колонка «Счет» присутствует не во всех выгрузках — ищем таблицу по
  // заголовку «Кор. Счет» и берём смещение колонок от него, а не по
  // фиксированной позиции.
  const headerIdx = rows.findIndex((r) =>
    r.some((cell) => typeof cell === "string" && cell.trim() === "Кор. Счет"),
  );
  if (headerIdx === -1) {
    throw new Error(
      "Не найдена таблица оборотов — проверьте, что это выгрузка «Анализ счёта 51» из 1С.",
    );
  }
  const headerRow = rows[headerIdx];
  const corrCol = headerRow.findIndex(
    (cell) => typeof cell === "string" && cell.trim() === "Кор. Счет",
  );
  const debitCol = corrCol + 1;
  const creditCol = corrCol + 2;
  const commentCol = corrCol + 3;

  const dataRows = rows
    .slice(headerIdx + 1)
    .filter((r) => r.some((cell) => cell !== null && cell !== ""));

  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  let turnoverDebit: number | null = null;
  let turnoverCredit: number | null = null;
  const result: CashFlowRow[] = [];

  for (const row of dataRows) {
    const label = typeof row[corrCol] === "string" ? row[corrCol].trim() : null;
    const debit = toNumber(row[debitCol]);
    const credit = toNumber(row[creditCol]);
    const comment =
      typeof row[commentCol] === "string" && row[commentCol].trim()
        ? row[commentCol].trim()
        : null;

    if (label === "Начальное сальдо") {
      openingBalance = debit ?? (credit !== null ? -credit : null);
      continue;
    }
    if (label === "Конечное сальдо") {
      closingBalance = debit ?? (credit !== null ? -credit : null);
      continue;
    }
    if (label === "Оборот") {
      turnoverDebit = debit;
      turnoverCredit = credit;
      continue;
    }
    if (!label && debit === null && credit === null) continue;

    result.push({
      corr_account: label,
      debit,
      credit,
      comment,
      raw: { row },
    });
  }

  if (!result.length) {
    throw new Error("Не удалось распознать ни одной строки оборотов в файле.");
  }

  return { periodMonth, rows: result, openingBalance, closingBalance, turnoverDebit, turnoverCredit };
}

// ---------------------------------------------------------------------
// Бухгалтерский баланс (0710001) + отчёт о финансовых результатах (0710002)
// ---------------------------------------------------------------------

export interface StatementLine {
  statement_type: "balance" | "income";
  code: string;
  label: string;
  value: number | null;
}

export interface StatementParseResult {
  periodYear: number;
  orgName: string | null;
  inn: string | null;
  lines: StatementLine[];
}

// Коды по форме 0710001/0710002. Один и тот же показатель у некоторых
// организаций из года в год выгружается под разными кодами (например,
// «Капитал» — то 1370, то 1300) — храним оба варианта как есть,
// в дашборде показываем то, что заполнено.
const BALANCE_LABELS: Record<string, string> = {
  "1150": "Материальные внеоборотные активы",
  "1160": "Нематериальные, финансовые и другие внеоборотные активы",
  "1170": "Нематериальные, финансовые и другие внеоборотные активы",
  "1210": "Запасы",
  "1230": "Финансовые и другие оборотные активы",
  "1240": "Финансовые и другие оборотные активы",
  "1250": "Денежные средства и денежные эквиваленты",
  "1300": "Капитал",
  "1370": "Капитал и резервы",
  "1410": "Долгосрочные заёмные средства",
  "1450": "Другие долгосрочные обязательства",
  "1500": "Краткосрочные обязательства",
  "1510": "Краткосрочные заёмные средства",
  "1520": "Кредиторская задолженность",
  "1550": "Другие краткосрочные обязательства",
  "1600": "БАЛАНС (актив)",
  "1700": "БАЛАНС (пассив)",
};

const INCOME_LABELS: Record<string, string> = {
  "2110": "Выручка",
  "2120": "Расходы по обычной деятельности",
  "2320": "Прочие доходы",
  "2330": "Проценты к уплате",
  "2340": "Прочие доходы",
  "2350": "Прочие расходы",
  "2400": "Чистая прибыль (убыток)",
  "2410": "Налог на прибыль",
};

// Число в русском формате: группы по 3 цифры через пробел, в скобках — отрицательное.
const NUMBER_RE = /\(?-?\d{1,3}(?:[\s ]\d{3})*\)?/;

function parseAmount(blob: string): number | null {
  const match = blob.match(NUMBER_RE);
  if (!match) return null;
  const raw = match[0];
  const negative = raw.startsWith("(");
  const digits = raw.replace(/[()\s ]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

/**
 * Ищет строки показателей внутри одного раздела формы (баланс или ОФР).
 * Разбор построен по кодам строк, а не по фиксированной раскладке —
 * из года в год порядок и состав подстрок в выгрузке немного меняется.
 */
function extractSection(
  text: string,
  prefix: "1" | "2",
  statementType: "balance" | "income",
  labels: Record<string, string>,
): StatementLine[] {
  const startIdx = text.search(/Наименование показател/i);
  if (startIdx === -1) return [];
  const zoneRest = text.slice(startIdx);
  const endIdx = zoneRest.search(/Руководитель|Директор/i);
  const zone = endIdx === -1 ? zoneRest : zoneRest.slice(0, endIdx);

  const lines = zone
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bareCodeRe = new RegExp(`^${prefix}\\d{3}$`);
  // Код всегда напрямую приклеен к концу названия строки (без пробела) —
  // требуем, чтобы перед ним стояла кириллическая буква, закрывающая скобка
  // (например «Чистая прибыль (убыток)2400...») или начало строки. Без
  // этого условия код случайно находится внутри числа с пробелом-
  // разделителем тысяч (например «...63 13872 118» → ложный код «1387»).
  const codeRe = new RegExp(`(?<=^|[А-Яа-яЁё)])(${prefix}\\d{3})([\\d\\s\\u00A0().,-]+)$`);

  const found = new Map<string, StatementLine>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (bareCodeRe.test(line)) {
      const code = line;
      const value = parseAmount(lines[i + 1] ?? "");
      if (!found.has(code)) {
        found.set(code, {
          statement_type: statementType,
          code,
          label: labels[code] ?? `Показатель ${code}`,
          value,
        });
      }
      continue;
    }

    const m = line.match(codeRe);
    if (m) {
      const code = m[1];
      const value = parseAmount(m[2]);
      if (!found.has(code)) {
        found.set(code, {
          statement_type: statementType,
          code,
          label: labels[code] ?? `Показатель ${code}`,
          value,
        });
      }
    }
  }

  return [...found.values()];
}

/** Разбирает PDF официальной формы 0710001 (баланс) + 0710002 (ОФР). */
export async function parseFinancialStatement(buffer: Buffer): Promise<StatementParseResult> {
  const data = await pdfParse(buffer);
  const text = data.text;

  const yearMatch = text.match(/на 31 декабря (\d{4})/i) ?? text.match(/за (\d{4})\s*г/i);
  const periodYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  const orgMatch = text.match(/Организация:?\s*(Общество[^\n]*?)(?:по ОКПО|\n|$)/i);
  const orgName = orgMatch ? orgMatch[1].replace(/\s+/g, " ").trim() : null;
  const innMatch = text.match(/ИНН\s*(\d{10,12})/i);
  const inn = innMatch ? innMatch[1] : null;

  const incomeIdx = text.search(/Отчет[её]?\s+о\s+финансовых\s+результат/i);
  const balanceText = incomeIdx === -1 ? text : text.slice(0, incomeIdx);
  const incomeText = incomeIdx === -1 ? "" : text.slice(incomeIdx);

  const lines = [
    ...extractSection(balanceText, "1", "balance", BALANCE_LABELS),
    ...extractSection(incomeText, "2", "income", INCOME_LABELS),
  ];

  if (!lines.length) {
    throw new Error(
      "Не удалось распознать строки баланса/отчёта — проверьте, что это официальная форма 0710001/0710002.",
    );
  }

  return { periodYear, orgName, inn, lines };
}
