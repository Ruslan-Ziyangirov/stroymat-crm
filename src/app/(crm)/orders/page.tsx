import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { OrdersKanban, type PipelineOrderRow } from "@/components/orders/orders-kanban";
import { StatCard } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isPrivileged } from "@/lib/auth";
import { getManagers } from "@/lib/queries/refs";
import { ACTIVE_DEAL_STAGES } from "@/lib/constants";
import { formatMoney, formatNumber } from "@/lib/format";
import type { DealStage, DealTaskType } from "@/lib/types";

export const metadata: Metadata = { title: "Заказы" };

export default async function OrdersPage() {
  const profile = await requireProfile();
  const privileged = isPrivileged(profile);
  const supabase = await createClient();

  const [ordersRes, tasksRes, settingsRes, managers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, number, total, comment, created_at, stage, stage_changed_at, manager_id, budget, priority, product_interest, urgency, deal_type, proposal_amount, rejection_reason, rejection_comment, client:clients(id, name, phone), manager:profiles!orders_manager_id_fkey(id, full_name)",
      )
      .order("stage_changed_at", { ascending: false }),
    supabase
      .from("deal_tasks")
      .select("order_id, due_at, type, comment")
      .eq("status", "open")
      .order("due_at", { ascending: true }),
    supabase.from("pipeline_settings").select("manager_active_deal_limit").eq("id", true).maybeSingle(),
    getManagers(),
  ]);

  const orders = ordersRes.data ?? [];
  const tasks = (tasksRes.data ?? []) as {
    order_id: string;
    due_at: string;
    type: DealTaskType;
    comment: string;
  }[];

  const openTaskByOrder = new Map<string, { due_at: string; type: DealTaskType; comment: string }>();
  for (const task of tasks) {
    if (!openTaskByOrder.has(task.order_id)) openTaskByOrder.set(task.order_id, task);
  }

  const rows: PipelineOrderRow[] = orders.map((o) => {
    const client = o.client as unknown as { id: string; name: string; phone: string | null } | null;
    return {
      id: o.id,
      number: o.number,
      client_id: client?.id ?? null,
      client_name: client?.name ?? "Клиент удалён",
      client_phone: client?.phone ?? null,
      total: Number(o.total ?? 0),
      comment: o.comment,
      created_at: o.created_at,
      stage: o.stage,
      stage_changed_at: o.stage_changed_at,
      manager_id: o.manager_id,
      manager_name: (o.manager as unknown as { full_name: string } | null)?.full_name ?? null,
      budget: o.budget,
      priority: o.priority,
      product_interest: o.product_interest,
      urgency: o.urgency,
      deal_type: o.deal_type,
      proposal_amount: o.proposal_amount,
      rejection_reason: o.rejection_reason,
      rejection_comment: o.rejection_comment,
      openTask: openTaskByOrder.get(o.id) ?? null,
    };
  });

  const active = rows.filter((r) => (ACTIVE_DEAL_STAGES as DealStage[]).includes(r.stage));
  const activeSum = active.reduce((sum, r) => sum + r.total, 0);
  const won = rows.filter((r) => r.stage === "won");

  return (
    <>
      <PageHeader
        title="Заказы"
        description="Воронка сделок: перетащите карточку на другой этап или откройте её, чтобы поставить следующий шаг."
        actions={
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="size-4" />
              Новый заказ
            </Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Всего заказов" value={formatNumber(rows.length)} />
        <StatCard
          label="В работе"
          value={formatNumber(active.length)}
          hint={`на ${formatMoney(activeSum)}`}
        />
        <StatCard
          label="Продано"
          value={formatNumber(won.length)}
          hint={`на ${formatMoney(won.reduce((s, r) => s + r.total, 0))}`}
        />
      </div>

      <OrdersKanban
        orders={rows}
        managers={managers}
        currentUserId={profile.id}
        privileged={privileged}
        managerDealLimit={settingsRes.data?.manager_active_deal_limit ?? 80}
      />
    </>
  );
}
