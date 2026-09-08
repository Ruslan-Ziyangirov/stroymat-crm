import type { Metadata } from "next";
import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ReportFilters } from "@/components/reports/report-filters";
import {
  AvgCheckChart,
  RankBarChart,
  RevenueChart,
} from "@/components/charts/monthly-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getStores } from "@/lib/queries/refs";
import { byStore, fetchOrderSlices, toMonthlyPoints } from "@/lib/queries/stats";
import { buildMonthlyInsights, comparePeriods } from "@/lib/analytics/insights";
import { formatMoney, formatMonth, formatNumber, growth } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ежемесячная отчётность" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; months?: string }>;
}) {
  await requireRole(["admin", "director"]);
  const { store, months: monthsParam } = await searchParams;
  const months = Number(monthsParam) || 12;

  const [orders, stores] = await Promise.all([
    fetchOrderSlices(months, store),
    getStores(),
  ]);

  const points = toMonthlyPoints(orders, months);
  const comparison = comparePeriods(points);
  const insights = buildMonthlyInsights(points);
  const storeRows = byStore(orders, stores, 0);

  const current = comparison?.current;
  const previous = comparison?.previous;
  const periodTotal = points.reduce((sum, p) => sum + p.amount, 0);
  const periodOrders = points.reduce((sum, p) => sum + p.orders, 0);

  // Таблица «месяц к месяцу» — от свежих к старым.
  const tableRows = [...points].reverse().map((point, index, arr) => {
    const prev = arr[index + 1];
    return {
      ...point,
      deltaAmount: prev ? growth(point.amount, prev.amount) : null,
      deltaOrders: prev ? growth(point.orders, prev.orders) : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Ежемесячная отчётность"
        description="Показатели за месяц, сравнение с предыдущими периодами и автоматические выводы."
        actions={<ReportFilters stores={stores} storeId={store} months={months} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Выручка текущего месяца"
          value={formatMoney(current?.amount ?? 0)}
          delta={comparison?.deltaAmount}
          hint={previous ? `было ${formatMoney(previous.amount)}` : undefined}
        />
        <StatCard
          label="Заказов"
          value={formatNumber(current?.orders ?? 0)}
          delta={comparison?.deltaOrders}
          hint={previous ? `было ${formatNumber(previous.orders)}` : undefined}
        />
        <StatCard
          label="Средний чек"
          value={formatMoney(current?.avgCheck ?? 0)}
          delta={comparison?.deltaAvgCheck}
        />
        <StatCard
          label="Активных клиентов"
          value={formatNumber(current?.clients ?? 0)}
          delta={comparison?.deltaClients}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Выручка и количество заказов</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={points} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Lightbulb className="text-primary size-4" />
            <CardTitle>Краткие выводы</CardTitle>
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
            <CardTitle>Средний чек</CardTitle>
          </CardHeader>
          <CardContent>
            <AvgCheckChart data={points} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Отчёт по магазинам за текущий месяц</CardTitle>
          </CardHeader>
          <CardContent>
            {storeRows.length ? (
              <RankBarChart
                data={storeRows.map((row) => ({ name: row.name, amount: row.amount }))}
                height={220}
              />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                За текущий месяц заказов ещё нет
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Свод по месяцам</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Месяц</TableHead>
                  <TableHead className="text-right">Заказов</TableHead>
                  <TableHead className="text-right">Динамика заказов</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Динамика суммы</TableHead>
                  <TableHead className="text-right">Средний чек</TableHead>
                  <TableHead className="text-right">Клиентов</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium capitalize">
                      {formatMonth(row.month)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.orders)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Delta value={row.deltaOrders} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(row.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Delta value={row.deltaAmount} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.avgCheck)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.clients)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Итого за период</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(periodOrders)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(periodTotal)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(periodOrders ? periodTotal / periodOrders : 0)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        Math.abs(value) < 0.05
          ? "text-muted-foreground"
          : up
            ? "text-emerald-600"
            : "text-red-600",
      )}
    >
      <Icon className="size-3.5" />
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(1).replace(".", ",")} %
    </span>
  );
}
