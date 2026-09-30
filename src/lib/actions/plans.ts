"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { planSchema } from "@/lib/validations";
import type { MutationResult } from "@/lib/actions/clients";

/** Создаёт план на месяц или обновляет существующий (по месяцу + компании / филиалу / менеджеру). */
export async function upsertPlan(values: unknown): Promise<MutationResult> {
  const parsed = planSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const profile = await requireRole(["admin", "director"]);
  const supabase = await createClient();
  const { month, target_amount } = parsed.data;
  // Личный план менеджера не привязываем к филиалу — это разные виды плана.
  const manager_id = parsed.data.manager_id ?? null;
  const store_id = manager_id ? null : (parsed.data.store_id ?? null);

  let existingQuery = supabase.from("monthly_plans").select("id").eq("month", month);
  existingQuery = store_id ? existingQuery.eq("store_id", store_id) : existingQuery.is("store_id", null);
  existingQuery = manager_id
    ? existingQuery.eq("manager_id", manager_id)
    : existingQuery.is("manager_id", null);
  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("monthly_plans")
      .update({ target_amount, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("monthly_plans").insert({
      month,
      store_id,
      manager_id,
      target_amount,
      created_by: profile.id,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/plans");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePlan(id: string): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { error } = await supabase.from("monthly_plans").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/plans");
  revalidatePath("/dashboard");
  return { ok: true };
}
