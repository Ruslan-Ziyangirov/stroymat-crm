"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { orderSchema } from "@/lib/validations";
import { assertManagerCapacity } from "@/lib/pipeline/capacity";
import type { MutationResult } from "@/lib/actions/clients";

/** Пересчёт итогов заказа на стороне БД (учитывает скидку и списанные бонусы). */
async function recalc(orderId: string) {
  const supabase = await createClient();
  await supabase.rpc("recalc_order_totals", { p_order_id: orderId });
}

export async function createOrder(values: unknown): Promise<MutationResult> {
  const parsed = orderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

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
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

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
    // Заказ без позиций не имеет смысла — откатываем вручную.
    await supabase.from("orders").delete().eq("id", created.id);
    return { ok: false, error: itemsError.message };
  }

  await recalc(created.id);
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
