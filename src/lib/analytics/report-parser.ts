import ExcelJS from "exceljs";
import Papa from "papaparse";

export interface ParsedRow {
  doc_date: string | null;
  period_month: string | null;
  client_name: string | null;
  order_number: string | null;
  product_name: string | null;
  category: string | null;
  quantity: number | null;
  amount: number | null;
  raw: Record<string, unknown>;
}

export interface ParseResult {
  columns: string[];
  rows: ParsedRow[];
  skipped: number;
}

/** Синонимы заголовков — распознаём типовые выгрузки из 1С и Excel. */
const FIELD_SYNONYMS: Record<string, string[]> = {
  doc_date: ["дата", "дата документа", "дата заказа", "период", "date"],
  client_name: ["клиент", "контрагент", "покупатель", "заказчик", "client", "customer"],
  order_number: ["номер", "заказ", "документ", "№", "номер заказа", "order"],
  product_name: ["номенклатура", "товар", "наименование", "материал", "product", "позиция"],
  category: ["категория", "группа", "вид", "category"],
  quantity: ["количество", "кол-во", "кол во", "quantity", "qty", "объем", "объём"],
  amount: ["сумма", "сумма продажи", "выручка", "итого", "стоимость", "amount", "total", "revenue"],
};

function normalizeHeader(value: string) {
  return value.toString().trim().toLowerCase().replace(/[.,;:_]+/g, " ").replace(/\s+/g, " ");
}

/** Сопоставляет заголовки файла с полями отчёта. */
export function mapColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header ?? "");
    if (!normalized) return;
    for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      if (map[field] !== undefined) continue;
      if (synonyms.some((s) => normalized === s || normalized.includes(s))) {
        map[field] = index;
        return;
      }
    }
  });
  return map;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .replace(/\s| /g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();
  // 31.12.2025 / 31-12-2025 / 31/12/2025
  const ru = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (ru) {
    const year = ru[3].length === 2 ? 2000 + Number(ru[3]) : Number(ru[3]);
    const d = new Date(Date.UTC(year, Number(ru[2]) - 1, Number(ru[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(str);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const monthStart = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);

/** Строки «Итого» и «Всего» — служебные, в данные они попадать не должны. */
// \b не работает с кириллицей, поэтому конец слова описываем явно.
const TOTAL_ROW = /^\s*(итого|итог|всего|подытог|total|subtotal)\s*([:,.]|по\b|$)/i;

function isTotalsRow(cells: unknown[]): boolean {
  return cells.some(
    (cell) => typeof cell === "string" && TOTAL_ROW.test(cell),
  );
}

function buildRows(headers: string[], matrix: unknown[][]): ParseResult {
  const map = mapColumns(headers);
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (const cells of matrix) {
    if (isTotalsRow(cells)) {
      skipped += 1;
      continue;
    }

    const raw: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) raw[h] = cells[i] ?? null;
    });

    const pick = (field: string) =>
      map[field] !== undefined ? cells[map[field]] : undefined;

    const amount = toNumber(pick("amount"));
    const productName = pick("product_name");
    const clientName = pick("client_name");

    // Строка без суммы и без содержательных полей — служебная (итоги, пустые строки).
    if (amount === null && !productName && !clientName) {
      skipped += 1;
      continue;
    }

    const date = toDate(pick("doc_date"));

    rows.push({
      doc_date: date ? isoDate(date) : null,
      period_month: date ? monthStart(date) : null,
      client_name: clientName ? String(clientName).trim() : null,
      order_number: pick("order_number") ? String(pick("order_number")).trim() : null,
      product_name: productName ? String(productName).trim() : null,
      category: pick("category") ? String(pick("category")).trim() : null,
      quantity: toNumber(pick("quantity")),
      amount,
      raw,
    });
  }

  return { columns: headers.filter(Boolean), rows, skipped };
}

/** Ищет строку заголовков — в выгрузках сверху часто идут «шапки». */
function findHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 15);
  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < limit; i += 1) {
    const cells = matrix[i].map((c) => (c === null || c === undefined ? "" : String(c)));
    const filled = cells.filter((c) => c.trim()).length;
    if (filled < 2) continue;
    const matched = Object.keys(mapColumns(cells)).length;
    const score = matched * 10 + filled;
    if (matched > 0 && score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { columns: [], rows: [], skipped: 0 };

  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    // ExcelJS отдаёт массив с 1-based индексами.
    matrix.push(values.slice(1).map((v) => normalizeCell(v)));
  });

  if (!matrix.length) return { columns: [], rows: [], skipped: 0 };

  const headerIndex = findHeaderRow(matrix);
  const headers = matrix[headerIndex].map((c) => (c ? String(c).trim() : ""));
  return buildRows(headers, matrix.slice(headerIndex + 1));
}

function normalizeCell(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const obj = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => r.text).join("");
    if (obj.text !== undefined) return obj.text;
    if (obj.result !== undefined) return obj.result;
    return null;
  }
  return value;
}

export function parseCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: true,
    delimiter: "",
  });
  const matrix = (parsed.data as unknown[][]) ?? [];
  if (!matrix.length) return { columns: [], rows: [], skipped: 0 };

  const headerIndex = findHeaderRow(matrix);
  const headers = matrix[headerIndex].map((c) => (c ? String(c).trim() : ""));
  return buildRows(headers, matrix.slice(headerIndex + 1));
}

export async function parseReportFile(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<ParseResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseCsv(new TextDecoder("utf-8").decode(buffer));
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    return parseXlsx(buffer);
  }
  throw new Error("Поддерживаются файлы .xlsx, .xlsm и .csv");
}
