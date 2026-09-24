import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DeleteFinanceUploadButton } from "@/components/reports/delete-finance-upload-button";
import { RankBarChart } from "@/components/charts/monthly-charts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cashFlowByCategory } from "@/lib/analytics/finance";
import { formatDateTime, formatMoney, formatMonth, formatNumber } from "@/lib/format";
import type { FinanceCashFlowRow, FinanceUpload } from "@/lib/types";

export const metadata: Metadata = { title: "Отчёт за месяц" };

export default async function CashFlowUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [uploadRes, rowsRes] = await Promise.all([
    supabase.from("finance_uploads").select("*").eq("id", id).eq("kind", "cash_flow_51").maybeSingle(),
    supabase
      .from("finance_cash_flow_rows")
      .select("*")
      .eq("upload_id", id)
      .order("debit", { ascending: false }),
  ]);

  if (!uploadRes.data) notFound();

  const upload = uploadRes.data as unknown as FinanceUpload;
  const rows = (rowsRes.data ?? []) as unknown as FinanceCashFlowRow[];
  const summary = upload.summary ?? {};

  const inflow = cashFlowByCategory(rows, "inflow");
  const outflow = cashFlowByCategory(rows, "outflow");
  const totalInflow = inflow.reduce((s, c) => s + c.amount, 0);
  const totalOutflow = outflow.reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <PageHeader
        title={upload.file_name}
        description={`${upload.period_month ? formatMonth(upload.period_month) : ""} · загружен ${formatDateTime(upload.created_at)}`}
        actions={<DeleteFinanceUploadButton id={upload.id} name={upload.file_name} />}
      />

      {upload.status === "failed" && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <TriangleAlert className="size-4" />
          <AlertTitle>Файл не разобран</AlertTitle>
          <AlertDescription>{upload.error}</AlertDescription>
        </Alert>
      )}

      {summary.turnoverMismatch && (
        <Alert className="mb-4 border-amber-200 bg-amber-50">
          <TriangleAlert className="size-4" />
          <AlertTitle>Сумма строк не совпадает со строкой «Оборот» в файле</AlertTitle>
          <AlertDescription>
            Это расхождение уже было в исходном файле из 1С — стоит свериться с оригиналом.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Начальное сальдо" value={summary.openingBalance != null ? formatMoney(summary.openingBalance) : "—"} />
        <StatCard label="Приток" value={formatMoney(totalInflow)} />
        <StatCard label="Отток" value={formatMoney(totalOutflow)} />
        <StatCard label="Конечное сальдо" value={summary.closingBalance != null ? formatMoney(summary.closingBalance) : "—"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Приток по статьям</CardTitle>
            <CardDescription>Поступления за этот месяц по укрупнённым статьям.</CardDescription>
          </CardHeader>
          <CardContent>
            {inflow.length ? (
              <RankBarChart
                data={inflow.slice(0, 8).map((c) => ({
                  name: c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name,
                  amount: c.amount,
                }))}
              />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">Притоков нет</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Отток по статьям</CardTitle>
            <CardDescription>Списания за этот месяц по укрупнённым статьям.</CardDescription>
          </CardHeader>
          <CardContent>
            {outflow.length ? (
              <RankBarChart
                data={outflow.slice(0, 8).map((c) => ({
                  name: c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name,
                  amount: c.amount,
                }))}
              />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">Оттоков нет</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Все строки ({formatNumber(rows.length)})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Корр. счёт</TableHead>
                  <TableHead>Статья</TableHead>
                  <TableHead className="text-right">Дебет (приток)</TableHead>
                  <TableHead className="text-right">Кредит (отток)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{row.corr_account ?? "—"}</TableCell>
                    <TableCell>{row.comment ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">
                      {row.debit ? formatMoney(row.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-700">
                      {row.credit ? formatMoney(row.credit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                      Строк нет
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
