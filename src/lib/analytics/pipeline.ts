import type { DealStage, DealTaskType } from "@/lib/types";

const TERMINAL_STAGES: DealStage[] = ["won", "closed_lost"];
// «Условный отказ» — сделка ещё занимает место в лимите менеджера (см.
// ACTIVE_DEAL_STAGES в constants.ts), но следующая задача по ней уже не
// нужна: менеджер её отпустил, дальше решает руководитель.
const TASK_EXEMPT_STAGES: DealStage[] = ["won", "closed_lost", "conditional_rejection"];

/** Сделки без движения дольше этого срока считаются «застрявшими». */
export const STUCK_DAYS_THRESHOLD = 14;

export function isTerminalStage(stage: DealStage): boolean {
  return TERMINAL_STAGES.includes(stage);
}

/** Нужна ли обязательная следующая задача при входе на этот этап. */
export function requiresNextTask(stage: DealStage): boolean {
  return !TASK_EXEMPT_STAGES.includes(stage);
}

const STAGE_TASK_TEMPLATES: Partial<
  Record<DealStage, { type: DealTaskType; inDays: number; comment: string }>
> = {
  new: { type: "call", inDays: 1, comment: "Связаться с клиентом, выяснить потребность" },
  contacted: { type: "call", inDays: 1, comment: "Уточнить объём и сроки, подготовить КП" },
  proposal_sent: { type: "call", inDays: 2, comment: "Убедиться, что КП получено, ответить на вопросы" },
  meeting_scheduled: { type: "meeting", inDays: 1, comment: "Провести встречу, согласовать заказ" },
};

/**
 * Следующая задача, которую система ставит сама при смене этапа (менеджер
 * задачу не заполняет). Дедлайн — через N дней в 10:00 по Москве; для встречи —
 * время самой встречи.
 */
export function stageTaskTemplate(
  stage: DealStage,
  now: Date = new Date(),
  meetingAt?: string,
): { type: DealTaskType; due_at: string; comment: string } | null {
  const template = STAGE_TASK_TEMPLATES[stage];
  if (!template) return null;
  const due = meetingAt
    ? new Date(meetingAt)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + template.inDays, 7));
  return { type: template.type, due_at: due.toISOString(), comment: template.comment };
}

export interface DealHealth {
  noTask: boolean;
  overdue: boolean;
  stuckDays: number;
  stuck: boolean;
}

/**
 * «Продажа → отказ → перенос»: у активной сделки всегда должна быть
 * следующая задача. Эти флаги — как быстро увидеть, где правило нарушено:
 * сделки без задач, просроченные задачи, сделки без движения слишком долго.
 */
export function dealHealth(
  stage: DealStage,
  stageChangedAt: string,
  openTaskDueAt: string | null,
  now: Date = new Date(),
): DealHealth {
  const needsTask = requiresNextTask(stage);
  const stuckDays = Math.floor((now.getTime() - new Date(stageChangedAt).getTime()) / 86_400_000);

  return {
    noTask: needsTask && !openTaskDueAt,
    overdue: needsTask && !!openTaskDueAt && new Date(openTaskDueAt).getTime() < now.getTime(),
    stuckDays,
    stuck: !isTerminalStage(stage) && stuckDays > STUCK_DAYS_THRESHOLD,
  };
}
