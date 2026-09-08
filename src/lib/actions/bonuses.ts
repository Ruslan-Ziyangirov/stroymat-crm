"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { bonusSchema } from "@/lib/validations";
import type { MutationResult } from "@/lib/actions/clients";

export async function addBonusTransaction(values: unknown): Promise<MutationResult> {
  const parsed = bonusSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  // Списать больше, чем есть на балансе, нельзя.
  if (parsed.data.type === "redeem") {
    const { data: client } = await supabase
      .from("clients")
      .select("bonus_balance")
      .eq("id", parsed.data.client_id)
      .maybeSingle();

    if (client && Number(client.bonus_balance) < parsed.data.points) {
      return {
        ok: false,
        error: `На балансе только ${Number(client.bonus_balance)} баллов`,
      };
    }
  }

  const { error } = await supabase.from("bonus_transactions").insert({
    client_id: parsed.data.client_id,
    type: parsed.data.type,
    points: parsed.data.points,
    comment: parsed.data.comment ?? null,
    created_by: profile.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/bonuses");
  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true };
}
