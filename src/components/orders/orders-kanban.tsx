"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, CalendarClock, Clock, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/common/badges";
import { NextStepDialog, type NextStepOrder } from "@/components/orders/next-step-dialog";
import { PipelineSettingsCard } from "@/components/orders/pipeline-settings-card";
import {
  ACTIVE_DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_ORDER,
  DEAL_TASK_TYPE_LABELS,
} from "@/lib/constants";
import { dealHealth } from "@/lib/analytics/pipeline";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealPriority, DealStage, DealTaskType, DealType, DealUrgency, Profile } from "@/lib/types";

export interface PipelineOrderRow {
  id: string;
  number: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  total: number;
  comment: string | null;
  created_at: string;
  stage: DealStage;
  stage_changed_at: string;
  manager_id: string | null;
  manager_name: string | null;
  budget: number | null;
  priority: DealPriority | null;
  product_interest: string | null;
  urgency: DealUrgency | null;
  deal_type: DealType | null;
  proposal_amount: number | null;
  rejection_reason: string | null;
  rejection_comment: string | null;
  openTask: { due_at: string; type: DealTaskType; comment: string } | null;
}

const QUICK_FILTERS = [
  { key: "noTask", label: "Без задачи" },
  { key: "overdue", label: "Просрочено" },
  { key: "stuck", label: "Долго на этапе" },
] as const;

type QuickFilterKey = (typeof QUICK_FILTERS)[number]["key"];

export function OrdersKanban({
  orders,
  managers,
  currentUserId,
  privileged,
  managerDealLimit,
}: {
  orders: PipelineOrderRow[];
  managers: Pick<Profile, "id" | "full_name">[];
  currentUserId: string;
  privileged: boolean;
  managerDealLimit: number;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [managerFilter, setManagerFilter] = React.useState<string>("__all__");
  const [activeFilters, setActiveFilters] = React.useState<Set<QuickFilterKey>>(new Set());
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [moveIntent, setMoveIntent] = React.useState<{ order: PipelineOrderRow; targetStage: DealStage } | null>(
    null,
  );
  const [openOrderId, setOpenOrderId] = React.useState<string | null>(null);

  const now = React.useMemo(() => new Date(), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const myActiveCount = orders.filter(
    (o) => o.manager_id === currentUserId && (ACTIVE_DEAL_STAGES as DealStage[]).includes(o.stage),
  ).length;

  const filtered = orders.filter((o) => {
    if (managerFilter !== "__all__" && o.manager_id !== managerFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!o.client_name.toLowerCase().includes(q) && !o.number.toLowerCase().includes(q)) return false;
    }
    if (activeFilters.size > 0) {
      const health = dealHealth(o.stage, o.stage_changed_at, o.openTask?.due_at ?? null, now);
      const matches = [...activeFilters].some((f) => health[f]);
      if (!matches) return false;
    }
    return true;
  });

  const byStage = new Map<DealStage, PipelineOrderRow[]>();
  for (const stage of DEAL_STAGE_ORDER) byStage.set(stage, []);
  for (const order of filtered) byStage.get(order.stage)?.push(order);

  const draggedOrder = orders.find((o) => o.id === activeDragId) ?? null;

  const onDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const targetStage = over.id as DealStage;
    const order = orders.find((o) => o.id === active.id);
    if (!order || order.stage === targetStage) return;
    setMoveIntent({ order, targetStage });
  };

  const toggleFilter = (key: QuickFilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openOrder = orders.find((o) => o.id === openOrderId) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по клиенту или номеру заказа"
            className="pl-9"
          />
        </div>

        {privileged && (
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все менеджеры</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => toggleFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeFilters.has(f.key)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="flex-1" />

        {privileged ? (
          <PipelineSettingsCard limit={managerDealLimit} />
        ) : (
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              myActiveCount >= managerDealLimit
                ? "bg-red-50 text-red-700"
                : "bg-muted text-muted-foreground",
            )}
          >
            У вас {myActiveCount} из {managerDealLimit} активных сделок
          </span>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {DEAL_STAGE_ORDER.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              orders={byStage.get(stage) ?? []}
              now={now}
              onOpenOrder={setOpenOrderId}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedOrder ? <OrderCard order={draggedOrder} now={now} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {moveIntent && (
        <NextStepDialog
          open
          onOpenChange={(open) => !open && setMoveIntent(null)}
          order={toNextStepOrder(moveIntent.order)}
          initialTargetStage={moveIntent.targetStage}
          managers={managers}
          canClose={privileged && moveIntent.order.stage === "conditional_rejection"}
          onDone={() => {
            setMoveIntent(null);
            router.refresh();
          }}
        />
      )}

      {openOrder && (
        <NextStepDialog
          open
          onOpenChange={(open) => !open && setOpenOrderId(null)}
          order={toNextStepOrder(openOrder)}
          managers={managers}
          canClose={privileged && openOrder.stage === "conditional_rejection"}
          onDone={() => setOpenOrderId(null)}
        />
      )}
    </div>
  );
}

function toNextStepOrder(o: PipelineOrderRow): NextStepOrder {
  return {
    id: o.id,
    number: o.number,
    name: `${o.client_name} · ${o.number}`,
    client_id: o.client_id,
    client_name: o.client_name,
    client_phone: o.client_phone,
    total: o.total,
    comment: o.comment,
    created_at: o.created_at,
    stage: o.stage,
    manager_id: o.manager_id,
    manager_name: o.manager_name,
    budget: o.budget,
    priority: o.priority,
    product_interest: o.product_interest,
    urgency: o.urgency,
    deal_type: o.deal_type,
    proposal_amount: o.proposal_amount,
    rejection_reason: o.rejection_reason,
    rejection_comment: o.rejection_comment,
    openTask: o.openTask,
  };
}

function KanbanColumn({
  stage,
  orders,
  now,
  onOpenOrder,
}: {
  stage: DealStage;
  orders: PipelineOrderRow[];
  now: Date;
  onOpenOrder: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="w-72 shrink-0">
      <div className="bg-muted/60 mb-3 rounded-2xl p-3">
        <p className="text-sm font-semibold">{DEAL_STAGE_LABELS[stage]}</p>
        <p className="text-muted-foreground text-xs">{orders.length}</p>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-16 space-y-2 rounded-2xl transition-colors",
          isOver && "bg-primary/5 ring-primary/30 ring-2",
        )}
      >
        {orders.map((order) => (
          <DraggableCard key={order.id} order={order} now={now} onOpen={() => onOpenOrder(order.id)} />
        ))}
        {!orders.length && (
          <p className="text-muted-foreground rounded-2xl border border-dashed p-4 text-center text-xs">
            Пусто
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  order,
  now,
  onOpen,
}: {
  order: PipelineOrderRow;
  now: Date;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onOpen}>
      <OrderCard order={order} now={now} />
    </div>
  );
}

function OrderCard({
  order,
  now,
  dragging,
}: {
  order: PipelineOrderRow;
  now: Date;
  dragging?: boolean;
}) {
  const health = dealHealth(order.stage, order.stage_changed_at, order.openTask?.due_at ?? null, now);

  return (
    <div
      className={cn(
        "bg-card block cursor-pointer rounded-2xl p-3 shadow-sm transition-colors hover:shadow-md",
        dragging && "shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{order.client_name}</p>
        {order.priority && <PriorityBadge priority={order.priority} />}
      </div>

      <p className="text-muted-foreground mt-0.5 truncate text-xs">
        {order.number}
        {order.manager_name ? ` · ${order.manager_name}` : ""}
      </p>

      {order.total > 0 && (
        <p className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(order.total)}</p>
      )}

      <div className="mt-2 space-y-1">
        {order.openTask ? (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              health.overdue ? "font-medium text-red-600" : "text-muted-foreground",
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" />
            <span className="truncate">
              {formatDateTime(order.openTask.due_at)} — {DEAL_TASK_TYPE_LABELS[order.openTask.type]}
            </span>
          </p>
        ) : health.noTask ? (
          <p className="flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertTriangle className="size-3.5 shrink-0" />
            Нет задачи
          </p>
        ) : null}

        {health.stuck && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-3.5 shrink-0" />
            {health.stuckDays} дн. на этапе
          </p>
        )}
      </div>
    </div>
  );
}
