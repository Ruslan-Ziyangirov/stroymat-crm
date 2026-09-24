import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  Store,
  Target,
  TriangleAlert,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { DealStageBadge } from "@/components/common/badges";
import { OrderFunnelChart, RevenueChart, StatusDonut } from "@/components/charts/monthly-charts";
import { CashFlowChart } from "@/components/charts/finance-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isPrivileged } from "@/lib/auth";
import { fetchOrderSlices, toMonthlyPoints, byStage } from "@/lib/queries/stats";
import { getStores, getManagers, getMonthlyPlans, currentMonthISO } from "@/lib/queries/refs";
import { getFinanceDashboardSummary } from "@/lib/queries/finance";
import { buildMonthlyInsights, comparePeriods } from "@/lib/analytics/insights";
import {
  storeRanking,
  managerRanking,
  stageFunnel,
  newVsReturning,
  churnCandidates,
  type RankRow,
} from "@/lib/analytics/dashboard";
import { dealHealth } from "@/lib/analytics/pipeline";
import { formatMoney, formatNumber, formatDate, formatPercent, daysSince } from "@/lib/format";
import { ACTIVE_DEAL_STAGES, DEAL_STAGE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DealStage, Order } from "@/lib/types";

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      )}
    >
      <Icon className="size-3" />
      {formatPercent(value)}
    </span>
  );
}

export const metadata: Metadata = { title: "Дашборд" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const privileged = isPrivileged(profile);

  const [latest, orders, stores, managers, activeOrdersRes, openTasksRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, stage, total, created_at, client:clients(id, name)")
      .order("created_at", { ascending: false })
      .limit(8),
    privileged ? fetchOrderSlices(12) : Promise.resolve([]),
    privileged ? getStores() : Promise.resolve([]),
    privileged ? getManagers() : Promise.resolve([]),
    privileged
      ? supabase
          .from("orders")
          .select(
            "id, number, stage, stage_changed_at, total, created_at, client:clients(id, name), store:stores(id, name)",
          )
          .in("stage", ACTIVE_DEAL_STAGES)
          .order("stage_changed_at", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] as (Order & { stage_changed_at: string })[] }),
    privileged
      ? supabase.from("deal_tasks").select("order_id, due_at").eq("status", "open")
      : Promise.resolve({ data: [] as { order_id: string; due_at: string }[] }),
  ]);

  const recent = (latest.data ?? []) as unknown as Order[];

  if (!privileged) {
    let storePlan: { target: number; actual: number } | null = null;
    if (profile.store_id) {
      const monthISO = currentMonthISO();
      const [plans, storeOrders] = await Promise.all([
        getMonthlyPlans(monthISO),
        fetchOrderSlices(1, profile.store_id),
      ]);
      const plan = plans.find((p) => p.store_id === profile.store_id);
      if (plan) {
        const [point] = toMonthlyPoints(storeOrders, 1);
        storePlan = { target: plan.target_amount, actual: point?.amount ?? 0 };
      }
    }

    return (
      <>
        <PageHeader
          title={`Здравствуйте, ${profile.full_name.split(" ")[0] || "коллега"}`}
          description="Ваши последние заказы."
          actions={
            <Button asChild>
              <Link href="/orders/new">Новый заказ</Link>
            </Button>
          }
        />

        {storePlan && (
          <Card className="mb-4">
            <CardHeader className="flex-row items-center gap-2">
              <Target className="text-primary size-4" />
              <CardTitle>План по филиалу на этот месяц</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold tabular-nums">
                  {formatMoney(storePlan.actual)}
                </span>
                <span className="text-muted-foreground">
                  из {formatMoney(storePlan.target)} (
                  {storePlan.target
                    ? Math.round((storePlan.actual / storePlan.target) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <Progress
                value={
                  storePlan.target
                    ? Math.min((storePlan.actual / storePlan.target) * 100, 100)
                    : 0
                }
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex-row items-center justify-between">
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
      </>
    );
  }

  const churn = churnCandidates(orders);
  const clientIds = [...new Set(orders.map((o) => o.client_id))];

  const [clientsCount, clientsInfoRes, plans, finance] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    clientIds.length
      ? supabase.from("clients").select("id, name, created_at").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string; created_at: string }[] }),
    getMonthlyPlans(currentMonthISO()),
    getFinanceDashboardSummary(),
  ]);

  const lastCashFlowMonth = finance.cashFlow[finance.cashFlow.length - 1];
  const lastFinanceYear = finance.statements[finance.statements.length - 1];

  const companyPlan = plans.find((p) => p.store_id === null)?.target_amount ?? null;
  const storePlanMap = new Map(
    plans.filter((p) => p.store_id).map((p) => [p.store_id as string, p.target_amount]),
  );

  const clientInfo = new Map((clientsInfoRes.data ?? []).map((c) => [c.id, c]));
  const clientCreatedAt = new Map(
    [...clientInfo.entries()].map(([id, c]) => [id, c.created_at]),
  );

  const points = toMonthlyPoints(orders, 12);
  const comparison = comparePeriods(points);
  const insights = buildMonthlyInsights(points);
  const stages = byStage(orders);

  const donut = [...stages.entries()].map(([stage, value]) => ({
    name: DEAL_STAGE_LABELS[stage as DealStage],
    value,
  }));

  const current = comparison?.current;
  const storeRank = storeRanking(orders, stores);
  const managerRank = managerRanking(orders, managers);
  const funnel = stageFunnel(orders);
  const { newCount, returningCount } = newVsReturning(orders, clientCreatedAt);
  const churnRows = churn.map((c) => ({ ...c, name: clientInfo.get(c.clientId)?.name ?? "Клиент" }));

  // Сделки без задачи / с просроченной задачей / долго на этапе — то, что
  // методология просит «быстро увидеть», теперь считаем по всем активным
  // заказам, а не по узкому набору статусов.
  const openDueByOrder = new Map<string, string>();
  for (const t of openTasksRes.data ?? []) {
    if (!openDueByOrder.has(t.order_id)) openDueByOrder.set(t.order_id, t.due_at);
  }
  const now = new Date();
  const stuck = ((activeOrdersRes.data ?? []) as unknown as (Order & { stage_changed_at: string })[])
    .filter((o) => {
      const health = dealHealth(o.stage, o.stage_changed_at, openDueByOrder.get(o.id) ?? null, now);
      return health.noTask || health.overdue || health.stuck;
    })
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title={`Здравствуйте, ${profile.full_name.split(" ")[0] || "коллега"}`}
        description="Сводка по текущему месяцу и динамика за последние 12 месяцев."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Выручка за месяц"
          value={formatMoney(current?.amount ?? 0)}
          delta={comparison?.deltaAmount}
          hint="к прошлому месяцу"
        />
        <StatCard
          label="Заказов за месяц"
          value={formatNumber(current?.orders ?? 0)}
          delta={comparison?.deltaOrders}
        />
        <StatCard
          label="Средний чек"
          value={formatMoney(current?.avgCheck ?? 0)}
          delta={comparison?.deltaAvgCheck}
        />
        <StatCard
          label="Клиентов в базе"
          value={formatNumber(clientsCount.count ?? 0)}
          hint={`активных в месяце: ${formatNumber(current?.clients ?? 0)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Динамика продаж</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={points} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Заказы по этапам воронки</CardTitle>
          </CardHeader>
          <CardContent>
            {donut.length ? (
              <StatusDonut data={donut} />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                Пока нет заказов
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center gap-2">
            <Store className="text-primary size-4" />
            <div className="flex-1">
              <CardTitle>Магазины за месяц</CardTitle>
              {companyPlan !== null && (
                <div className="mt-2 max-w-sm">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">План по компании</span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(current?.amount ?? 0)} из {formatMoney(companyPlan)} (
                      {companyPlan ? Math.round(((current?.amount ?? 0) / companyPlan) * 100) : 0}
                      %)
                    </span>
                  </div>
                  <Progress
                    value={
                      companyPlan
                        ? Math.min(((current?.amount ?? 0) / companyPlan) * 100, 100)
                        : 0
                    }
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {storeRank.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Магазин</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                    <TableHead className="text-right">Заказов</TableHead>
                    <TableHead className="text-right">Средний чек</TableHead>
                    <TableHead className="text-right">% плана</TableHead>
                    <TableHead className="text-right">К прошлому месяцу</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storeRank.map((row: RankRow) => {
                    const target = storePlanMap.get(row.id);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.avgCheck)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {target ? `${Math.round((row.amount / target) * 100)} %` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <GrowthBadge value={row.growth} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground px-6 py-10 text-center text-sm">
                В этом месяце заказов ещё не было
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Воронка сделок</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel.created ? (
              <OrderFunnelChart
                data={[
                  { name: "Оформлено", value: funnel.created },
                  { name: "В работе", value: funnel.inProgress },
                  {
                    name: "Продано",
                    value: funnel.won,
                    hint: `${(funnel.wonRate ?? 0).toFixed(0)} %`,
                  },
                ]}
              />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                В этом месяце сделок ещё не было.
              </p>
            )}
            {funnel.rejected > 0 && (
              <p className="text-muted-foreground mt-2 text-center text-xs">
                Ещё {formatNumber(funnel.rejected)} — условный отказ или не реализовано
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="text-primary size-4" />
              <CardTitle>Финансы</CardTitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/finance">
                Подробнее <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {finance.cashFlow.length ? (
              <CashFlowChart data={finance.cashFlow.slice(-12)} />
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">
                Загрузите отчёты в разделе «Финансы», чтобы увидеть динамику.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Итоги</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-muted-foreground text-xs">
                Чистый поток {lastCashFlowMonth ? `· ${formatDate(lastCashFlowMonth.month)}` : ""}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {lastCashFlowMonth ? formatMoney(lastCashFlowMonth.net) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-muted-foreground text-xs">
                Выручка за {lastFinanceYear ? `${lastFinanceYear.year} г.` : "год"}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {lastFinanceYear?.revenue != null ? formatMoney(lastFinanceYear.revenue * 1000) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-muted-foreground text-xs">
                Чистая прибыль за {lastFinanceYear ? `${lastFinanceYear.year} г.` : "год"}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {lastFinanceYear?.netProfit != null ? formatMoney(lastFinanceYear.netProfit * 1000) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center gap-2">
            <Trophy className="text-primary size-4" />
            <CardTitle>Менеджеры за месяц</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {managerRank.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Менеджер</TableHead>
                    <TableHead className="text-right">Выручка</TableHead>
                    <TableHead className="text-right">Заказов</TableHead>
                    <TableHead className="text-right">Средний чек</TableHead>
                    <TableHead className="text-right">К прошлому месяцу</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managerRank.map((row: RankRow) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.avgCheck)}
                      </TableCell>
                      <TableCell className="text-right">
                        <GrowthBadge value={row.growth} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground px-6 py-10 text-center text-sm">
                В этом месяце заказов ещё не было
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <UserRound className="text-primary size-4" />
            <CardTitle>Клиенты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs">Новые в этом месяце</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(newCount)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs">Повторные покупки</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(returningCount)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Риск оттока — заказывали регулярно, затихли
              </p>
              {churnRows.length ? (
                <ul className="space-y-2">
                  {churnRows.map((c) => (
                    <li key={c.clientId} className="flex items-center justify-between text-sm">
                      <Link href={`/clients/${c.clientId}`} className="truncate hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {daysSince(c.lastOrderAt)} дн. назад
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Постоянные клиенты активны.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center gap-2">
          <TriangleAlert className="size-4 text-amber-600" />
          <CardTitle>Сделки, требующие внимания</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stuck.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Заказ</TableHead>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Магазин</TableHead>
                  <TableHead>Этап</TableHead>
                  <TableHead className="text-right">На этапе</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuck.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.number}
                      </Link>
                    </TableCell>
                    <TableCell>{order.client?.name ?? "Клиент удалён"}</TableCell>
                    <TableCell>{order.store?.name ?? "—"}</TableCell>
                    <TableCell>
                      <DealStageBadge stage={order.stage} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {daysSince(order.stage_changed_at)} дн.
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              По всем активным сделкам есть задача, она не просрочена, и сделка не застряла на
              этапе.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
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
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
