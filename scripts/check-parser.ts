/**
 * Ручная проверка распознавания отчётов: генерирует типовую выгрузку,
 * прогоняет её через парсер и печатает свод.
 * Запуск: npx tsx scripts/check-parser.ts
 */
import ExcelJS from "exceljs";
import { parseReportFile } from "../src/lib/analytics/report-parser";
import { aggregateRows, buildUploadInsights } from "../src/lib/analytics/insights";

async function makeWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Продажи");

  // Типовая «шапка» выгрузки из 1С — парсер должен её пропустить.
  sheet.addRow(["Отчёт о продажах"]);
  sheet.addRow(["Период: 01.01.2026 - 31.03.2026"]);
  sheet.addRow([]);
  sheet.addRow(["Дата", "Контрагент", "Номер документа", "Номенклатура", "Кол-во", "Сумма"]);

  const rows: [string, string, string, string, number, number][] = [
    ["15.01.2026", "ООО «СтройДом»", "РН-001", "Цемент М500, 50 кг", 40, 24800],
    ["18.01.2026", "ИП Ковалёв А.С.", "РН-002", "Кирпич керамический", 2000, 44000],
    ["04.02.2026", "ООО «СтройДом»", "РН-003", "Цемент М500, 50 кг", 60, 37200],
    ["19.02.2026", "ООО «РемонтПро»", "РН-004", "Гипсокартон 12.5 мм", 120, 57600],
    ["03.03.2026", "ООО «РемонтПро»", "РН-005", "Утеплитель минвата", 80, 108000],
    ["21.03.2026", "ИП Ковалёв А.С.", "РН-006", "Доска обрезная", 3, 44400],
  ];
  rows.forEach((row) => sheet.addRow(row));
  sheet.addRow([]);
  sheet.addRow(["", "", "", "Итого:", "", 316000]);

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

async function main() {
  const buffer = await makeWorkbook();
  const parsed = await parseReportFile("prodazhi.xlsx", buffer);

  console.log("Колонки:", parsed.columns);
  console.log("Распознано строк:", parsed.rows.length, "| пропущено:", parsed.skipped);
  console.log("Первая строка:", parsed.rows[0]);

  const aggregate = aggregateRows(parsed.rows);
  console.log("Месяцы:", aggregate.months);
  console.log("Итого:", aggregate.totalAmount);
  console.log("Выводы:");
  buildUploadInsights(aggregate).forEach((line) => console.log(" -", line));

  // Тот же набор данных в CSV.
  const csv = [
    "Дата;Клиент;Номенклатура;Количество;Сумма",
    "15.01.2026;ООО «СтройДом»;Цемент М500;40;24 800,00",
    "04.02.2026;ООО «СтройДом»;Цемент М500;60;37 200,00",
  ].join("\n");
  const csvParsed = await parseReportFile(
    "report.csv",
    new TextEncoder().encode(csv).buffer as ArrayBuffer,
  );
  console.log("CSV строк:", csvParsed.rows.length, csvParsed.rows.map((r) => r.amount));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
