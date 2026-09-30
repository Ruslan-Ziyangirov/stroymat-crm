"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole } from "@/lib/auth";
import { dealStageEnum, dealStageFieldsSchema, dealTaskSchema } from "@/lib/validations";
import { assertManagerCapacity } from "@/lib/pipeline/capacity";
import { ACTIVE_DEAL_STAGES, DEAL_STAGE_LABELS } from "@/lib/constants";
import { requiresNextTask, stageTaskTemplate } from "@/lib/analytics/pipeline";
import type { MutationResult } from "@/lib/actions/clients";
import type { DealStage } from "@/lib/types";

interface MoveOrderStagePayload {
  targetStage: unknown;
  fields?: unknown;
  task?: unknown;
  /** Что произошло по текущей задаче — сохраняется в закрытую задачу и в историю. */
  result?: unknown;
}

const isCountedActive = (stage: DealStage) => (ACTIVE_DEAL_STAGES as DealStage[]).includes(stage);

/**
 * Единая точка перехода заказа (сделки) между этапами воронки. Закрывает
 * разом несколько правил методологии: обязательные поля под этап,
 * обязательная следующая задача, запрет менеджеру самому закрывать
 * «отказ», лимит активных сделок на менеджера — проверяется здесь, а не
 * только в UI.
 */
export async function moveOrderStage(
  orderId: string,
  payload: MoveOrderStagePayload,
): Promise<MutationResult> {
  const stageParsed = dealStageEnum.safeParse(payload.targetStage);
  if (!stageParsed.success) return { ok: false, error: "Некорректный этап" };
  const targetStage = stageParsed.data;

  const fieldsParsed = dealStageFieldsSchema.safeParse(payload.fields ?? {});
  if (!fieldsParsed.success) {
    return { ok: false, error: fieldsParsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const fields = fieldsParsed.data;

  // Следующая задача: если её не передали явно, система ставит её сама по
  // шаблону этапа — правило «у активной сделки всегда есть следующий шаг»
  // соблюдается без отдельного блока в форме.
  let task: ReturnType<typeof dealTaskSchema.parse> | undefined;
  if (requiresNextTask(targetStage)) {
    if (payload.task) {
      const taskParsed = dealTaskSchema.safeParse(payload.task);
      if (!taskParsed.success) {
        return {
          ok: false,
          error: taskParsed.error.issues[0]?.message ?? "Укажите следующую задачу по сделке",
        };
      }
      task = taskParsed.data;
    } else {
      const template = stageTaskTemplate(targetStage, new Date(), fields.meeting_at);
      if (template) task = { ...template, assignee_id: undefined };
    }
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, number, stage, manager_id, client_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) return { ok: false, error: orderError.message };
  if (!order) return { ok: false, error: "Заказ не найден" };

  const currentStage = order.stage as DealStage;
  const stageChanged = targetStage !== currentStage;
  const result = typeof payload.result === "string" ? payload.result.trim() : "";

  if (!stageChanged && !result) {
    return { ok: false, error: "Запишите, что произошло, или выберите другой этап." };
  }

  // «Закрыто и не реализовано» — только из «Условного отказа», и только
  // руководитель/админ, никогда сам менеджер.
  if (stageChanged && targetStage === "closed_lost") {
    if (currentStage !== "conditional_rejection") {
      return {
        ok: false,
        error:
          "Сначала переведите заказ в «Условный отказ» — закрыть его как нереализованный может только руководитель.",
      };
    }
    if (profile.role !== "admin" && profile.role !== "director") {
      return {
        ok: false,
        error: "Закрыть заказ как нереализованный может только руководитель или администратор.",
      };
    }
  }

  // Обязательные поля под целевой этап (гейтинг: технически нельзя перейти
  // без нужных данных). Проверяем только при смене этапа — запись звонка
  // внутри этапа не должна заново требовать уже внесённые поля.
  if (stageChanged && targetStage === "won") {
    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);
    if (!count) {
      return {
        ok: false,
        error: "Добавьте в заказ хотя бы одну позицию, прежде чем переводить его в «Продажу».",
      };
    }
  }
  if (stageChanged && targetStage === "proposal_sent") {
    const missing =
      !fields.priority ||
      !fields.product_interest ||
      !fields.deal_type ||
      fields.proposal_amount === undefined;
    if (missing) {
      return {
        ok: false,
        error:
          "Для «КП отправлено» укажите сумму КП, приоритет, интересующий товар и тип сделки.",
      };
    }
  }
  if (stageChanged && targetStage === "meeting_scheduled" && !fields.meeting_at) {
    return { ok: false, error: "Укажите дату и время встречи." };
  }
  if (
    stageChanged &&
    targetStage === "conditional_rejection" &&
    (!fields.rejection_reason || !fields.rejection_comment)
  ) {
    return { ok: false, error: "Выберите причину отказа и опишите ситуацию." };
  }

  // Лимит менеджера — проверяем только когда сделка реактивируется
  // (была вне подсчёта активных — «Продажа»/«Закрыто» — и возвращается в работу).
  if (isCountedActive(targetStage) && !isCountedActive(currentStage)) {
    const capacityError = await assertManagerCapacity(supabase, order.manager_id, order.id);
    if (capacityError) return { ok: false, error: capacityError };
  }

  const nowIso = new Date().toISOString();
  // «Дней на этапе» считаются от stage_changed_at, поэтому сбрасываем его
  // только при реальной смене этапа — иначе звонки «оживляли» бы застрявшую сделку.
  const updatePayload: Record<string, unknown> = { updated_at: nowIso };
  if (stageChanged) {
    updatePayload.stage = targetStage;
    updatePayload.stage_changed_at = nowIso;
  }
  if (fields.budget !== undefined) updatePayload.budget = fields.budget;
  if (fields.priority) updatePayload.priority = fields.priority;
  if (fields.product_interest) updatePayload.product_interest = fields.product_interest;
  if (fields.urgency) updatePayload.urgency = fields.urgency;
  if (fields.deal_type) updatePayload.deal_type = fields.deal_type;
  if (fields.proposal_amount !== undefined) updatePayload.proposal_amount = fields.proposal_amount;
  if (fields.meeting_at) updatePayload.meeting_at = new Date(fields.meeting_at).toISOString();
  if (stageChanged && targetStage === "conditional_rejection") {
    updatePayload.rejection_reason = fields.rejection_reason;
    updatePayload.rejection_comment = fields.rejection_comment;
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("id")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) {
    return { ok: false, error: "Недостаточно прав для изменения этого заказа." };
  }

  // Новый шаг закрывает прежнюю открытую задачу, вместе с её результатом.
  await supabase
    .from("deal_tasks")
    .update({ status: "done", completed_at: nowIso, ...(result ? { result } : {}) })
    .eq("order_id", orderId)
    .eq("status", "open");

  if (task) {
    const { error: taskError } = await supabase.from("deal_tasks").insert({
      order_id: orderId,
      assignee_id: task.assignee_id ?? order.manager_id ?? profile.id,
      type: task.type,
      due_at: new Date(task.due_at).toISOString(),
      comment: task.comment,
      created_by: profile.id,
    });
    if (taskError) return { ok: false, error: taskError.message };
  }

  // Триггер БД сам пишет запись в client_events при смене stage — здесь
  // добавляем только более развёрнутый комментарий по причине отказа/задаче,
  // если он есть (базовую запись «этап X → Y» создаёт trg_order_history()).
  const parts: string[] = [];
  if (result) parts.push(`Результат: ${result}`);
  if (stageChanged && targetStage === "conditional_rejection") {
    parts.push([fields.rejection_reason, fields.rejection_comment].filter(Boolean).join(". "));
  }
  if (task) parts.push(`Следующий шаг: ${task.comment}`);
  const extra = parts.join("\n");
  if (extra) {
    await supabase.from("client_events").insert({
      client_id: order.client_id,
      order_id: orderId,
      type: "note",
      title: `Заказ ${order.number}: ${DEAL_STAGE_LABELS[targetStage]}`,
      description: extra,
      created_by: profile.id,
    });
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  return { ok: true, id: orderId };
}

/** Лимит активных сделок на менеджера — редактирует руководитель/админ. */
export async function savePipelineSettings(limit: number): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  if (!Number.isFinite(limit) || limit < 1) {
    return { ok: false, error: "Лимит должен быть положительным числом" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pipeline_settings")
    .update({ manager_active_deal_limit: Math.round(limit), updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/orders");
  return { ok: true };
}
