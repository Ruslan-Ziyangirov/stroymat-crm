"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { clientEventSchema, clientSchema } from "@/lib/validations";

export interface MutationResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export async function createClientRecord(values: unknown): Promise<MutationResult> {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...parsed.data,
      manager_id: parsed.data.manager_id ?? profile.id,
      store_id: parsed.data.store_id ?? profile.store_id,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/clients");
  return { ok: true, id: data.id };
}

export async function updateClientRecord(
  id: string,
  values: unknown,
): Promise<MutationResult> {
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, id };
}

export async function deleteClientRecord(id: string): Promise<MutationResult> {
  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("violates foreign key")
        ? "Нельзя удалить клиента с заказами."
        : error.message,
    };
  }

  revalidatePath("/clients");
  return { ok: true };
}

/** Заметка, звонок или встреча в историю работы с клиентом. */
export async function addClientEvent(values: unknown): Promise<MutationResult> {
  const parsed = clientEventSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("client_events").insert({
    ...parsed.data,
    created_by: profile.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  return { ok: true };
}
