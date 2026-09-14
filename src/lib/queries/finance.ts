import { createClient } from "@/lib/supabase/server";
import { aggregateCashFlowByMonth, summarizeStatementsByYear } from "@/lib/analytics/finance";
import type { FinanceCashFlowRow, FinanceStatementLine } from "@/lib/types";

/** Все строки движения по счёту 51 (для дашборда и сводных графиков). */
export async function getCashFlowRows() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("finance_cash_flow_rows")
    .select("id, upload_id, period_month, corr_account, debit, credit, comment, raw")
    .order("period_month", { ascending: true })
    .limit(20000);
  return (data ?? []) as unknown as FinanceCashFlowRow[];
}

/** Все строки баланса/ОФР по всем годовым отчётам. */
export async function getStatementLines() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("finance_statement_lines")
    .select("id, upload_id, period_year, statement_type, code, label, value, position")
    .order("period_year", { ascending: true });
  return (data ?? []) as unknown as FinanceStatementLine[];
}

/** Сжатая сводка для карточки на дашборде — без сырых строк. */
export async function getFinanceDashboardSummary() {
  const [cashFlowRows, statementLines] = await Promise.all([getCashFlowRows(), getStatementLines()]);
  const cashFlow = aggregateCashFlowByMonth(cashFlowRows);
  const statements = summarizeStatementsByYear(statementLines);
  return { cashFlow, statements };
}
