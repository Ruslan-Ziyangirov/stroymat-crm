import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lightbulb, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DeleteUploadButton } from "@/components/reports/delete-upload-button";
import { RankBarChart, RevenueChart } from "@/components/charts/monthly-charts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatDate, formatDateTime, formatMoney, formatMonth, formatNumber, growth } from "@/lib/format";
import type { ReportRow, ReportUpload } from "@/lib/types";

export const metadata: Metadata = { title: "Разбор отчёта" };

export default async function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [uploadRes, rowsRes] = await Promise.all([
    supabase
      .from("report_uploads")
      .select("*, store:stores(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("report_rows")
      .select("*")
      .eq("upload_id", id)
      .order("doc_date", { ascending: false })
      .limit(100),
  ]);

  if (!uploadRes.data) notFound();

  const upload = uploadRes.data as unknown as ReportUpload;
  const rows = (rowsRes.data ?? []) as unknown as ReportRow[];
  const summary = upload.summary ?? {};
  const months = summary.months ?? [];

  const chartPoints = months.map((m) => ({
    month: m.month,
    amount: m.amount,
    orders: m.rows,
    avgCheck: m.rows ? m.amount / m.rows : 0,
    clients: 0,
  }));

  const last = months[months.length - 1];
  const prev = months[months.length - 2];

  // Месяцы, где сумма сильно отличается от средней по файлу.
  const avg = months.length
    ? months.reduce((s, m) => s + m.amount, 0) / months.length
    : 0;
  const anomalies = months.filter(
    (m) => avg > 0 && Math.abs(m.amount - avg) / avg > 0.3,
  );

  return (
    <>
      <PageHeader
        title={upload.file_name}
        description={`Загружен ${formatDateTime(upload.created_at)}${upload.store?.name ? ` · ${upload.store.name}` : ""}`}
        actions={<DeleteUploadButton id={upload.id} name={upload.file_name} />}
      />

      {upload.status === "failed" && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <TriangleAlert className="size-4" />
          <AlertTitle>Файл не разобран</AlertTitle>
          <AlertDescription>{upload.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Распознано строк" value={formatNumber(upload.rows_count)} />
        <StatCard label="Сумма по файлу" value={formatMoney(upload.total_amount)} />
        <StatCard
          label="Последний месяц файла"
          value={last ? formatMoney(last.amount) : "—"}
          delta={last && prev ? growth(last.amount, prev.amount) : undefined}
          hint={last ? formatMonth(last.month) : undefined}
        />
        <StatCard
          label="Отклонений найдено"
          value={formatNumber(anomalies.length)}
          hint="месяцев с отклонением > 30 %"
          invert
        />
      </div>

      {summary.columns && summary.columns.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="text-muted-foreground mr-1 text-xs">Распознанные колонки:</span>
          {summary.columns.map((column) => (
            <Badge key={column} variant="secondary" className="font-normal">
              {column}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Динамика по файлу</CardTitle>
          </CardHeader>
          <CardContent>
            {chartPoints.length ? (
              <RevenueChart data={chartPoints} />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                В файле не распознаны даты — динамику построить нельзя
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Lightbulb className="text-primary size-4" />
            <CardTitle>Краткие выводы</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(summary.insights ?? []).map((text, i) => (
                <li key={i} className="text-muted-foreground flex gap-2 text-sm">
                  <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                  <span>{text}</span>
                </li>
              ))}
              {anomalies.map((m) => (
                <li key={m.month} className="flex gap-2 text-sm text-amber-700">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {formatMonth(m.month)}: {formatMoney(m.amount)} — отклонение от среднего
                    уровня по файлу ({formatMoney(avg)}).
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {(summary.topProducts?.length ?? 0) > 0 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Топ номенклатуры файла</CardTitle>
            </CardHeader>
            <CardContent>
              <RankBarChart
                data={(summary.topProducts ?? []).slice(0, 7).map((p) => ({
                  name: p.name.length > 28 ? `${p.name.slice(0, 27)}…` : p.name,
                  amount: p.amount,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Топ клиентов файла</CardTitle>
            </CardHeader>
            <CardContent>
              <RankBarChart
                data={(summary.topClients ?? []).slice(0, 7).map((c) => ({
                  name: c.name.length > 28 ? `${c.name.slice(0, 27)}…` : c.name,
                  amount: c.amount,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Распознанные строки (первые 100)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Дата</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Документ</TableHead>
                  <TableHead>Номенклатура</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.doc_date)}
                    </TableCell>
                    <TableCell>{row.client_name ?? "—"}</TableCell>
                    <TableCell>{row.order_number ?? "—"}</TableCell>
                    <TableCell>{row.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.quantity !== null ? formatNumber(row.quantity, 3) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(row.amount ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
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
