import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { UploadForm } from "@/components/reports/upload-form";
import { RankBarChart, RevenueChart } from "@/components/charts/monthly-charts";
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
import { getStores } from "@/lib/queries/refs";
import { aggregateRows, buildUploadInsights } from "@/lib/analytics/insights";
import { formatDateTime, formatMoney, formatMonth, formatNumber, growth } from "@/lib/format";
import type { ReportUpload } from "@/lib/types";

export const metadata: Metadata = { title: "Загрузка и анализ отчётов" };

export default async function UploadsPage() {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [uploadsRes, rowsRes, stores] = await Promise.all([
    supabase
      .from("report_uploads")
      .select("*, store:stores(id, name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("report_rows")
      .select("period_month, product_name, client_name, quantity, amount")
      .limit(20000),
    getStores(),
  ]);

  const uploads = (uploadsRes.data ?? []) as unknown as ReportUpload[];
  const rows = (rowsRes.data ?? []) as {
    period_month: string | null;
    product_name: string | null;
    client_name: string | null;
    quantity: number | null;
    amount: number | null;
  }[];

  // Общая отчётность — объединение всех загруженных выгрузок.
  const combined = aggregateRows(rows);
  const insights = rows.length ? buildUploadInsights(combined) : [];

  const chartPoints = combined.months.map((m) => ({
    month: m.month,
    amount: m.amount,
    orders: m.rows,
    avgCheck: m.rows ? m.amount / m.rows : 0,
    clients: 0,
  }));

  const lastMonth = combined.months[combined.months.length - 1];
  const prevMonth = combined.months[combined.months.length - 2];

  return (
    <>
      <PageHeader
        title="Загрузка и анализ отчётов"
        description="Загружайте выгрузки из Excel или 1С — система распознает данные, объединит их в общую отчётность и найдёт отклонения."
      />

      <UploadForm stores={stores} />

      {rows.length > 0 && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Строк в базе отчётов"
              value={formatNumber(combined.rowsCount)}
              hint={`загрузок: ${uploads.length}`}
            />
            <StatCard label="Общая сумма" value={formatMoney(combined.totalAmount)} />
            <StatCard
              label="Последний месяц"
              value={lastMonth ? formatMoney(lastMonth.amount) : "—"}
              delta={
                lastMonth && prevMonth ? growth(lastMonth.amount, prevMonth.amount) : undefined
              }
              hint={lastMonth ? formatMonth(lastMonth.month) : undefined}
            />
            <StatCard
              label="Периодов в данных"
              value={formatNumber(combined.months.length)}
              hint="месяцев с данными"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Сводная динамика по загруженным отчётам</CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart data={chartPoints} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center gap-2">
                <Lightbulb className="text-primary size-4" />
                <CardTitle>Выводы по объединённым данным</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {insights.map((text, i) => (
                    <li key={i} className="text-muted-foreground flex gap-2 text-sm">
                      <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Топ номенклатуры</CardTitle>
              </CardHeader>
              <CardContent>
                <RankBarChart
                  data={combined.topProducts.slice(0, 7).map((p) => ({
                    name: p.name.length > 28 ? `${p.name.slice(0, 27)}…` : p.name,
                    amount: p.amount,
                  }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Топ клиентов</CardTitle>
              </CardHeader>
              <CardContent>
                <RankBarChart
                  data={combined.topClients.slice(0, 7).map((c) => ({
                    name: c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name,
                    amount: c.amount,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>История загрузок</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Файл</TableHead>
                  <TableHead>Магазин</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead className="text-right">Строк</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Загружен</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.length ? (
                  uploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <Link
                          href={`/uploads/${upload.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {upload.file_name}
                        </Link>
                      </TableCell>
                      <TableCell>{upload.store?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap capitalize">
                        {upload.period_start ? formatMonth(upload.period_start) : "—"}
                        {upload.period_end && upload.period_end !== upload.period_start
                          ? ` — ${formatMonth(upload.period_end)}`
                          : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(upload.rows_count)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(upload.total_amount)}
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
                    <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
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
