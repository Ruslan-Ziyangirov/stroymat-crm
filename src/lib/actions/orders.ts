"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { dealTaskSchema, leadSchema, orderSchema } from "@/lib/validations";
import { assertManagerCapacity } from "@/lib/pipeline/capacity";
import type { MutationResult } from "@/lib/actions/clients";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Пересчёт итогов заказа на стороне БД (учитывает скидку и списанные бонусы). */
async function recalc(orderId: string) {
  const supabase = await createClient();
  await supabase.rpc("recalc_order_totals", { p_order_id: orderId });
}

/**
 * Новая сделка сразу получает первую задачу — иначе с первой секунды
 * она висит в «Нет задачи» и нарушает правило «у сделки всегда есть следующий шаг».
 */
async function insertFirstTask(
  supabase: SupabaseServer,
  order: { id: string; client_id: string; number: string },
  managerId: string,
  authorId: string,
  task: ReturnType<typeof dealTaskSchema.parse>,
) {
  const { error } = await supabase.from("deal_tasks").insert({
    order_id: order.id,
    assignee_id: task.assignee_id ?? managerId,
    type: task.type,
    due_at: new Date(task.due_at).toISOString(),
    comment: task.comment,
    created_by: authorId,
  });
  if (error) return error.message;

  await supabase.from("client_events").insert({
    client_id: order.client_id,
    order_id: order.id,
    type: "note",
    title: `Заказ ${order.number}: первый шаг`,
    description: task.comment,
    created_by: authorId,
  });
  return null;
}

function parseTask(task: unknown) {
  const parsed = dealTaskSchema.safeParse(task ?? {});
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Укажите первую задачу по сделке" } as const;
  }
  return { data: parsed.data } as const;
}

export async function createOrder(values: unknown, task: unknown): Promise<MutationResult> {
  const parsed = orderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const taskParsed = parseTask(task);
  if ("error" in taskParsed) return { ok: false, error: taskParsed.error };

  const profile = await requireProfile();
  const supabase = await createClient();
  const { items, ...order } = parsed.data;
  const managerId = order.manager_id ?? profile.id;

  const capacityError = await assertManagerCapacity(supabase, managerId);
  if (capacityError) return { ok: false, error: capacityError };

  const { data: created, error } = await supabase
    .from("orders")
    .insert({
      ...order,
      manager_id: managerId,
      store_id: order.store_id ?? profile.store_id,
      created_by: profile.id,
    })
    .select("id, number, client_id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (items.length) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item, index) => ({
        order_id: created.id,
        product_id: item.product_id ?? null,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        position: index,
      })),
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", created.id);
      return { ok: false, error: itemsError.message };
    }
  }

  const taskError = await insertFirstTask(supabase, created, managerId, profile.id, taskParsed.data);
  if (taskError) return { ok: false, error: taskError };

  await recalc(created.id);
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true, id: created.id };
}

/** Быстрый лид: сделка без состава заказа — позиции добавят, когда дойдёт до КП. */
export async function createLead(values: unknown, task: unknown): Promise<MutationResult> {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const taskParsed = parseTask(task);
  if ("error" in taskParsed) return { ok: false, error: taskParsed.error };

  const profile = await requireProfile();
  const supabase = await createClient();
  const lead = parsed.data;
  const managerId = lead.manager_id ?? profile.id;

  const capacityError = await assertManagerCapacity(supabase, managerId);
  if (capacityError) return { ok: false, error: capacityError };

  const { data: created, error } = await supabase
    .from("orders")
    .insert({
      client_id: lead.client_id,
      manager_id: managerId,
      store_id: lead.store_id ?? profile.store_id,
      product_interest: lead.product_interest,
      comment: lead.comment,
      created_by: profile.id,
    })
    .select("id, number, client_id")
    .single();

  if (error) return { ok: false, error: error.message };

  const taskError = await insertFirstTask(supabase, created, managerId, profile.id, taskParsed.data);
  if (taskError) return { ok: false, error: taskError };

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true, id: created.id };
}

export async function updateOrder(id: string, values: unknown): Promise<MutationResult> {
  const parsed = orderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireProfile();
  const supabase = await createClient();
  const { items, ...order } = parsed.data;

  if (!items.length) {
    const { data: current } = await supabase.from("orders").select("stage").eq("id", id).maybeSingle();
    if (current?.stage === "won") {
      return { ok: false, error: "У проданного заказа должна быть хотя бы одна позиция." };
    }
  }

  if (order.manager_id) {
    const { data: existing } = await supabase
      .from("orders")
      .select("manager_id")
      .eq("id", id)
      .maybeSingle();

    if (existing && existing.manager_id !== order.manager_id) {
      const capacityError = await assertManagerCapacity(supabase, order.manager_id, id);
      if (capacityError) return { ok: false, error: capacityError };
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({ ...order, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Состав заказа перезаписываем целиком — так проще держать позиции в порядке.
  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (items.length) {
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item, index) => ({
        order_id: id,
        product_id: item.product_id ?? null,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        position: index,
      })),
    );
    if (itemsError) return { ok: false, error: itemsError.message };
  }

  await recalc(id);
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function deleteOrder(id: string): Promise<MutationResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true };
}
