import type { Metadata } from "next";
import { Target } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanForm } from "@/components/plans/plan-form";
import { DeletePlanButton } from "@/components/plans/delete-plan-button";
import { requireRole } from "@/lib/auth";
import { getAllPlans, getManagers, getStores, currentMonthISO } from "@/lib/queries/refs";
import { formatMoney, formatMonth } from "@/lib/format";
import type { MonthlyPlan } from "@/lib/types";

export const metadata: Metadata = { title: "Планы продаж" };

function planTarget(plan: MonthlyPlan) {
  if (plan.manager_id) return `Менеджер: ${plan.manager?.full_name ?? "удалён"}`;
  if (plan.store_id) return plan.store?.name ?? "Филиал удалён";
  return "Компания целиком";
}

export default async function PlansPage() {
  await requireRole(["admin", "director"]);

  const [stores, managers, plans] = await Promise.all([getStores(), getManagers(), getAllPlans()]);

  return (
    <>
      <PageHeader
        title="Планы продаж"
        description="Плановая выручка на месяц — по компании, по филиалам и личные планы менеджеров. Менеджер видит свой план и прогресс на дашборде."
      />

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Target className="text-primary size-4" />
          <CardTitle>Установить план</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanForm stores={stores} managers={managers} defaultMonth={currentMonthISO()} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Все планы</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {plans.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Месяц</TableHead>
                  <TableHead>План для</TableHead>
                  <TableHead className="text-right">План</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const target = planTarget(plan);
                  const label = `${formatMonth(plan.month)} · ${target}`;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{formatMonth(plan.month)}</TableCell>
                      <TableCell>{target}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(plan.target_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeletePlanButton id={plan.id} label={label} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              Планы ещё не заданы.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
