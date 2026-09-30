import { ACTIVE_DEAL_STAGES, DEAL_STAGE_ORDER } from "@/lib/constants";
import { dealHealth, requiresNextTask } from "@/lib/analytics/pipeline";
import type { DealStage, DealTaskType } from "@/lib/types";

export interface ManagerOrder {
  id: string;
  number: string;
  total: number;
  stage: DealStage;
  created_at: string;
  stage_changed_at: string;
  rejection_reason: string | null;
  client_name: string;
}

export interface OpenTask {
  order_id: string;
  due_at: string;
  type: DealTaskType;
  comment: string;
}

/** Окно, за которое считаем конверсию и причины отказов. */
export const DECISION_WINDOW_DAYS = 90;

const DAY = 86_400_000;

function monthStart(date: Date, offset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function inRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

const isLost = (stage: DealStage) => stage === "conditional_rejection" || stage === "closed_lost";

/**
 * Продажа засчитывается в месяц, когда сделку перевели в «Продажу»
 * (stage_changed_at), а не когда её создали — это результат работы менеджера.
 */
function wonIn(orders: ManagerOrder[], from: Date, to: Date) {
  const won = orders.filter((o) => o.stage === "won" && inRange(o.stage_changed_at, from, to));
  const amount = won.reduce((s, o) => s + Number(o.total ?? 0), 0);
  return { orders: won, count: won.length, amount };
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export interface PlanProgress {
  target: number | null;
  actual: number;
  percent: number | null;
  /** Прогноз на конец месяца при текущем темпе. */
  forecast: number;
  /** Сколько нужно продавать в день до конца месяца, чтобы выполнить план. */
  neededPerDay: number | null;
  daysLeft: number;
}

export interface ManagerSummary {
  plan: PlanProgress;
  salesCount: number;
  salesCountDelta: number | null;
  avgCheck: number;
  avgCheckDelta: number | null;
  /** Доля «Продаж» среди решённых сделок за DECISION_WINDOW_DAYS, %. */
  conversion: number | null;
  decidedCount: number;
  /** Средний срок от создания сделки до «Продажи», дней. */
  avgCycleDays: number | null;
  activeCount: number;
  pipeline: { stage: DealStage; count: number; amount: number }[];
  rejectionReasons: { reason: string; count: number }[];
}

export function summarizeManager(
  orders: ManagerOrder[],
  planTarget: number | null,
  now: Date = new Date(),
): ManagerSummary {
  const thisMonth = monthStart(now);
  const nextMonth = monthStart(now, 1);
  const prevMonth = monthStart(now, -1);

  const current = wonIn(orders, thisMonth, nextMonth);
  const previous = wonIn(orders, prevMonth, thisMonth);

  const daysInMonth = Math.round((nextMonth.getTime() - thisMonth.getTime()) / DAY);
  const dayOfMonth = now.getUTCDate();
  const daysLeft = daysInMonth - dayOfMonth + 1;
  const forecast = (current.amount / dayOfMonth) * daysInMonth;
  const remaining = planTarget !== null ? Math.max(planTarget - current.amount, 0) : null;

  const avgCheck = current.count ? current.amount / current.count : 0;
  const prevAvgCheck = previous.count ? previous.amount / previous.count : 0;

  const windowStart = new Date(now.getTime() - DECISION_WINDOW_DAYS * DAY);
  const decided = orders.filter(
    (o) => (o.stage === "won" || isLost(o.stage)) && new Date(o.stage_changed_at) >= windowStart,
  );
  const decidedWon = decided.filter((o) => o.stage === "won").length;

  const cycles = current.orders.map(
    (o) => (new Date(o.stage_changed_at).getTime() - new Date(o.created_at).getTime()) / DAY,
  );

  const pipeline = DEAL_STAGE_ORDER.filter((s) => ACTIVE_DEAL_STAGES.includes(s)).map((stage) => {
    const inStage = orders.filter((o) => o.stage === stage);
    return {
      stage,
      count: inStage.length,
      amount: inStage.reduce((s, o) => s + Number(o.total ?? 0), 0),
    };
  });

  const reasons = new Map<string, number>();
  for (const o of decided) {
    if (!isLost(o.stage)) continue;
    const reason = o.rejection_reason?.trim() || "Причина не указана";
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return {
    plan: {
      target: planTarget,
      actual: current.amount,
      percent: planTarget ? (current.amount / planTarget) * 100 : null,
      forecast,
      neededPerDay: remaining !== null ? remaining / daysLeft : null,
      daysLeft,
    },
    salesCount: current.count,
    salesCountDelta: pctDelta(current.count, previous.count),
    avgCheck,
    avgCheckDelta: pctDelta(avgCheck, prevAvgCheck),
    conversion: decided.length ? (decidedWon / decided.length) * 100 : null,
    decidedCount: decided.length,
    avgCycleDays: cycles.length ? cycles.reduce((s, d) => s + d, 0) / cycles.length : null,
    activeCount: orders.filter((o) => ACTIVE_DEAL_STAGES.includes(o.stage)).length,
    pipeline,
    rejectionReasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export type WorkBucket = "overdue" | "noTask" | "today" | "tomorrow" | "later";

export const WORK_BUCKET_ORDER: WorkBucket[] = ["overdue", "noTask", "today", "tomorrow", "later"];

export interface WorkItem {
  bucket: WorkBucket;
  orderId: string;
  orderNumber: string;
  clientName: string;
  stage: DealStage;
  task: Omit<OpenTask, "order_id"> | null;
  /** Заполнено, если сделка дольше порога без смены этапа. */
  stuckDays: number | null;
}

/** День в московском времени (YYYY-MM-DD) — сервер на Vercel живёт в UTC. */
const moscowDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });

/**
 * «Мои сделки в работе»: каждая сделка, по которой менеджеру нужно что-то
 * делать, со своим следующим шагом — от просроченного к плановому.
 * «Условный отказ» сюда не попадает: сделку отпустили, решает руководитель.
 */
export function buildWorkList(
  orders: ManagerOrder[],
  openTasks: OpenTask[],
  now: Date = new Date(),
): WorkItem[] {
  const nextTaskByOrder = new Map<string, OpenTask>();
  for (const task of openTasks) {
    const known = nextTaskByOrder.get(task.order_id);
    if (!known || task.due_at < known.due_at) nextTaskByOrder.set(task.order_id, task);
  }

  const today = moscowDay(now);
  const tomorrow = moscowDay(new Date(now.getTime() + DAY));

  const items: WorkItem[] = orders
    .filter((o) => requiresNextTask(o.stage) && ACTIVE_DEAL_STAGES.includes(o.stage))
    .map((order) => {
      const task = nextTaskByOrder.get(order.id) ?? null;
      const health = dealHealth(order.stage, order.stage_changed_at, task?.due_at ?? null, now);

      let bucket: WorkBucket;
      if (!task) bucket = "noTask";
      else if (new Date(task.due_at) < now) bucket = "overdue";
      else {
        const day = moscowDay(new Date(task.due_at));
        bucket = day === today ? "today" : day === tomorrow ? "tomorrow" : "later";
      }

      return {
        bucket,
        orderId: order.id,
        orderNumber: order.number,
        clientName: order.client_name,
        stage: order.stage,
        task: task ? { due_at: task.due_at, type: task.type, comment: task.comment } : null,
        stuckDays: health.stuck ? health.stuckDays : null,
      };
    });

  return items.sort(
    (a, b) =>
      WORK_BUCKET_ORDER.indexOf(a.bucket) - WORK_BUCKET_ORDER.indexOf(b.bucket) ||
      (a.task && b.task ? a.task.due_at.localeCompare(b.task.due_at) : 0),
  );
}
