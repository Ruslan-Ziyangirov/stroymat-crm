import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { CashFlowUploadForm, StatementUploadForm } from "@/components/reports/finance-upload-forms";
import { CashFlowChart, YearlyBarChart } from "@/components/charts/finance-charts";
import { RankBarChart } from "@/components/charts/monthly-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  aggregateCashFlowByMonth,
  buildFinanceInsights,
  cashFlowByCategory,
  summarizeStatementsByYear,
} from "@/lib/analytics/finance";
import { formatDateTime, formatMoney, formatMonth, formatNumber, growth } from "@/lib/format";
import type { FinanceCashFlowRow, FinanceStatementLine, FinanceUpload } from "@/lib/types";

export const metadata: Metadata = { title: "Финансы" };

export default async function FinancePage() {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [uploadsRes, cashFlowRowsRes, statementLinesRes] = await Promise.all([
    supabase.from("finance_uploads").select("*").order("created_at", { ascending: false }),
    supabase
      .from("finance_cash_flow_rows")
      .select("id, upload_id, period_month, corr_account, debit, credit, comment, raw")
      .limit(20000),
    supabase
      .from("finance_statement_lines")
      .select("id, upload_id, period_year, statement_type, code, label, value, position")
      .order("period_year", { ascending: true }),
  ]);

  const uploads = (uploadsRes.data ?? []) as unknown as FinanceUpload[];
  const cashFlowRows = (cashFlowRowsRes.data ?? []) as unknown as FinanceCashFlowRow[];
  const statementLines = (statementLinesRes.data ?? []) as unknown as FinanceStatementLine[];

  const cashFlowUploads = uploads.filter((u) => u.kind === "cash_flow_51");
  const statementUploads = uploads.filter((u) => u.kind === "financial_statement");

  const cashFlowMonths = aggregateCashFlowByMonth(cashFlowRows);
  const statements = summarizeStatementsByYear(statementLines);
  const insights = buildFinanceInsights(cashFlowMonths, statements);

  const inflowByCategory = cashFlowByCategory(cashFlowRows, "inflow").slice(0, 7);
  const outflowByCategory = cashFlowByCategory(cashFlowRows, "outflow").slice(0, 7);

  const lastMonth = cashFlowMonths[cashFlowMonths.length - 1];
  const prevMonth = cashFlowMonths[cashFlowMonths.length - 2];
  const lastYear = statements[statements.length - 1];
  const prevYear = statements.length > 1 ? statements[statements.length - 2] : undefined;

  const mismatchedUploads = cashFlowUploads.filter((u) => u.summary?.turnoverMismatch);

  return (
    <>
      <PageHeader
        title="Финансы"
        description="Движение денег по расчётному счёту (помесячно) и годовая бухгалтерская отчётность — баланс и финансовый результат."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Чистый денежный поток"
          value={lastMonth ? formatMoney(lastMonth.net) : "—"}
          delta={lastMonth && prevMonth ? growth(lastMonth.net, prevMonth.net) : undefined}
          hint={lastMonth ? formatMonth(lastMonth.month) : undefined}
        />
        <StatCard
          label="Приток за месяц"
          value={lastMonth ? formatMoney(lastMonth.inflow) : "—"}
          hint={lastMonth ? formatMonth(lastMonth.month) : undefined}
        />
        <StatCard
          label="Выручка за год"
          value={lastYear?.revenue !== null && lastYear?.revenue !== undefined ? formatMoney(lastYear.revenue * 1000) : "—"}
          delta={
            lastYear?.revenue && prevYear?.revenue
              ? growth(lastYear.revenue, prevYear.revenue)
              : undefined
          }
          hint={lastYear ? `${lastYear.year} г.` : undefined}
        />
        <StatCard
          label="Чистая прибыль за год"
          value={
            lastYear?.netProfit !== null && lastYear?.netProfit !== undefined
              ? formatMoney(lastYear.netProfit * 1000)
              : "—"
          }
          hint={lastYear ? `${lastYear.year} г.` : undefined}
        />
      </div>

      {mismatchedUploads.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            В {mismatchedUploads.length === 1 ? "файле" : "файлах"}{" "}
            {mismatchedUploads.map((u, i) => (
              <span key={u.id}>
                {i > 0 && ", "}
                <Link href={`/finance/cash-flow/${u.id}`} className="underline">
                  {u.file_name}
                </Link>
              </span>
            ))}{" "}
            сумма строк не совпадает со строкой «Оборот» в исходнике — возможно, в 1С отчёт свёрнут не
            полностью. Стоит свериться с оригиналом.
          </span>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CashFlowUploadForm />
        <StatementUploadForm />
      </div>

      {cashFlowMonths.length > 0 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Движение денег по счёту 51</CardTitle>
            </CardHeader>
            <CardContent>
              <CashFlowChart data={cashFlowMonths} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Lightbulb className="text-primary size-4" />
              <CardTitle>Автоматические выводы</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {insights.map((text, i) => (
                  <li key={i} className="text-muted-foreground flex gap-2 text-sm">
                    <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                    <span>{text}</span>
                  </li>
                ))}
                {!insights.length && <li className="text-muted-foreground text-sm">Загрузите отчёты, чтобы увидеть выводы.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {(inflowByCategory.length > 0 || outflowByCategory.length > 0) && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Приток по статьям</CardTitle>
            </CardHeader>
            <CardContent>
              <RankBarChart
                data={inflowByCategory.map((c) => ({
                  name: c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name,
                  amount: c.amount,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Отток по статьям</CardTitle>
            </CardHeader>
            <CardContent>
              <RankBarChart
                data={outflowByCategory.map((c) => ({
                  name: c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name,
                  amount: c.amount,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {statements.length > 0 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Выручка по годам</CardTitle>
            </CardHeader>
            <CardContent>
              <YearlyBarChart
                data={statements.filter((s) => s.revenue !== null).map((s) => ({ year: s.year, value: s.revenue! }))}
                name="Выручка"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Чистая прибыль по годам</CardTitle>
            </CardHeader>
            <CardContent>
              <YearlyBarChart
                data={statements.filter((s) => s.netProfit !== null).map((s) => ({ year: s.year, value: s.netProfit! }))}
                name="Чистая прибыль"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Загрузки: анализ счёта 51</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Файл</TableHead>
                  <TableHead>Месяц</TableHead>
                  <TableHead className="text-right">Строк</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Загружен</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlowUploads.length ? (
                  cashFlowUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <Link
                          href={`/finance/cash-flow/${upload.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {upload.file_name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap capitalize">
                        {upload.period_month ? formatMonth(upload.period_month) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(upload.rows_count)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={upload.status} error={upload.error} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(upload.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      Отчёты ещё не загружались
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Загрузки: баланс и ОФР</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Файл</TableHead>
                  <TableHead>Год</TableHead>
                  <TableHead className="text-right">Строк</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Загружен</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statementUploads.length ? (
                  statementUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <Link
                          href={`/finance/statements/${upload.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {upload.file_name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{upload.period_year ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(upload.rows_count)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={upload.status} error={upload.error} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(upload.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      Отчёты ещё не загружались
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "parsed") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        Разобран
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700" title={error ?? ""}>
        Ошибка
      </Badge>
    );
  }
  return <Badge variant="outline">Загружен</Badge>;
}
