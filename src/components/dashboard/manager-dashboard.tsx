import Link from "next/link";
import { ArrowRight, Gauge, ListTodo, Target, XCircle } from "lucide-react";

import { StatCard } from "@/components/common/stat-card";
import { DealStageBadge } from "@/components/common/badges";
import { WorkList } from "@/components/dashboard/work-list";
import type { NextStepOrder } from "@/components/orders/next-step-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DECISION_WINDOW_DAYS, type ManagerSummary, type WorkItem } from "@/lib/analytics/manager";
import { DEAL_STAGE_LABELS } from "@/lib/constants";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

const percentText = (value: number) => `${Math.round(value)} %`;

export function ManagerDashboard({
  summary,
  workItems,
  workOrders,
  recent,
  dealLimit,
}: {
  summary: ManagerSummary;
  workItems: WorkItem[];
  workOrders: Record<string, NextStepOrder>;
  recent: Order[];
  dealLimit: number;
}) {
  const { plan } = summary;
  const loadPercent = dealLimit ? (summary.activeCount / dealLimit) * 100 : 0;
  const maxStageCount = Math.max(...summary.pipeline.map((p) => p.count), 1);
  const maxReason = Math.max(...summary.rejectionReasons.map((r) => r.count), 1);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <Target className="text-primary size-4" />
            <CardTitle>Мой план на месяц</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan.target !== null ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-3xl font-bold tabular-nums">{formatMoney(plan.actual)}</p>
                  <p className="text-muted-foreground text-sm">
                    из {formatMoney(plan.target)} ·{" "}
                    <span className="text-foreground font-semibold">
                      {percentText(plan.percent ?? 0)}
                    </span>
                  </p>
                </div>
                <Progress value={Math.min(plan.percent ?? 0, 100)} className="h-2.5" />
              </>
            ) : (
              <div>
                <p className="text-3xl font-bold tabular-nums">{formatMoney(plan.actual)}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  продано в этом месяце. Личный план ещё не установлен — его задаёт руководитель в
                  разделе «Планы продаж».
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat
                label="Прогноз на конец месяца"
                value={formatMoney(plan.forecast)}
                tone={
                  plan.target === null ? undefined : plan.forecast >= plan.target ? "good" : "bad"
                }
                hint="при текущем темпе продаж"
              />
              <MiniStat
                label="Нужно продавать в день"
                value={
                  plan.neededPerDay === null
                    ? "—"
                    : plan.neededPerDay === 0
                      ? "План выполнен"
                      : formatMoney(plan.neededPerDay)
                }
                tone={plan.neededPerDay === 0 ? "good" : undefined}
                hint="чтобы закрыть план"
              />
              <MiniStat
                label="До конца месяца"
                value={`${plan.daysLeft} дн.`}
                hint="включая сегодня"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Gauge className="text-primary size-4" />
            <CardTitle>Загрузка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold tabular-nums">
              {formatNumber(summary.activeCount)}
              <span className="text-muted-foreground text-base font-normal">
                {" "}
                из {formatNumber(dealLimit)}
              </span>
            </p>
            <Progress
              value={Math.min(loadPercent, 100)}
              className={cn("h-2.5", loadPercent >= 90 && "[&>div]:bg-red-500")}
            />
            <p className="text-muted-foreground text-sm">
              {loadPercent >= 100
                ? "Лимит активных сделок исчерпан — новые сделки взять нельзя, пока не закроете часть текущих."
                : loadPercent >= 90
                  ? "Почти на пределе — доведите или закройте часть сделок."
                  : "активных сделок в работе"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Продаж за месяц"
          value={formatNumber(summary.salesCount)}
          delta={summary.salesCountDelta}
          hint="к прошлому месяцу"
        />
        <StatCard
          label="Средний чек"
          value={formatMoney(summary.avgCheck)}
          delta={summary.avgCheckDelta}
          hint="к прошлому месяцу"
        />
        <StatCard
          label="Конверсия в продажу"
          value={summary.conversion === null ? "—" : percentText(summary.conversion)}
          hint={`за ${DECISION_WINDOW_DAYS} дней, решено сделок: ${formatNumber(summary.decidedCount)}`}
        />
        <StatCard
          label="Средний срок сделки"
          value={summary.avgCycleDays === null ? "—" : `${Math.round(summary.avgCycleDays)} дн.`}
          hint="от создания до продажи"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <ListTodo className="text-primary size-4" />
            <div className="flex-1">
              <CardTitle>Мои сделки в работе</CardTitle>
              <CardDescription>
                Следующий шаг по каждой сделке — от срочного к плановому. Нажмите, чтобы отметить
                результат или сменить этап.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <WorkList items={workItems} orders={workOrders} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Моя воронка</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders">
                Открыть <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.pipeline.map((row) => (
              <div key={row.stage}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span>{DEAL_STAGE_LABELS[row.stage]}</span>
                  <span className="text-muted-foreground tabular-nums">
                    <span className="text-foreground font-medium">{formatNumber(row.count)}</span>
                    {row.amount > 0 && ` · ${formatMoney(row.amount)}`}
                  </span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${(row.count / maxStageCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Последние заказы</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders">Все заказы</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {recent.length ? (
                recent.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="hover:bg-muted/50 flex items-center gap-3 px-6 py-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {order.client?.name ?? "Клиент удалён"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {order.number} · {formatDate(order.created_at)}
                        </p>
                      </div>
                      <DealStageBadge stage={order.stage} />
                      <span className="w-28 text-right text-sm font-semibold tabular-nums">
                        {formatMoney(order.total)}
                      </span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground px-6 py-10 text-center text-sm">
                  Заказов пока нет
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <XCircle className="text-primary size-4" />
            <div>
              <CardTitle>Причины отказов</CardTitle>
              <CardDescription>за {DECISION_WINDOW_DAYS} дней</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.rejectionReasons.length ? (
              summary.rejectionReasons.map((row) => (
                <div key={row.reason}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate">{row.reason}</span>
                    <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-red-400"
                      style={{ width: `${(row.count / maxReason) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">Отказов за этот период не было.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-amber-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
