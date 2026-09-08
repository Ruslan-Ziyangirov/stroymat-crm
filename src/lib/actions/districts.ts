"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { districtSchema } from "@/lib/validations";
import {
  explainDistrict,
  recommendationFor,
  scoreDistrict,
  totalScore,
} from "@/lib/analytics/district";
import type { MutationResult } from "@/lib/actions/clients";
import type { DistrictInputs } from "@/lib/types";

/** Считает оценку района по заполненным критериям. */
function evaluate(values: ReturnType<typeof districtSchema.parse>) {
  const { name, city, comment, ...rest } = values;
  const inputs: DistrictInputs = { ...rest, comment };
  const scores = scoreDistrict(inputs);
  const total = totalScore(scores);

  return {
    name,
    city: city ?? null,
    inputs,
    scores,
    total_score: total,
    verdict: explainDistrict(inputs, scores, total),
    recommendation: recommendationFor(inputs, scores, total),
  };
}

export async function createDistrict(values: unknown): Promise<MutationResult> {
  const parsed = districtSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const profile = await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("district_analyses")
    .insert({ ...evaluate(parsed.data), created_by: profile.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/districts");
  return { ok: true, id: data.id };
}

export async function updateDistrict(
  id: string,
  values: unknown,
): Promise<MutationResult> {
  const parsed = districtSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("district_analyses")
    .update({ ...evaluate(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/districts");
  revalidatePath(`/districts/${id}`);
  return { ok: true, id };
}

export async function deleteDistrict(id: string): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { error } = await supabase.from("district_analyses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/districts");
  return { ok: true };
}
