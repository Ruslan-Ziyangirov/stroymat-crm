import type { DealStage } from "@/lib/types";

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
