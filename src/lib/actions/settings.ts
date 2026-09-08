"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile, requireRole } from "@/lib/auth";
import { productSchema, storeSchema, userSchema } from "@/lib/validations";
import type { MutationResult } from "@/lib/actions/clients";
import type { UserRole } from "@/lib/types";

/* ------------------------------- Номенклатура ------------------------------ */

export async function saveProduct(
  values: unknown,
  id?: string,
): Promise<MutationResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const payload = {
    name: parsed.data.name,
    sku: parsed.data.sku ?? null,
    category: parsed.data.category ?? null,
    unit: parsed.data.unit,
    price: parsed.data.price,
    is_active: parsed.data.is_active,
  };

  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id)
    : await supabase.from("products").insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("violates foreign key")
        ? "Товар используется в заказах. Снимите отметку «Активен» вместо удаления."
        : error.message,
    };
  }

  revalidatePath("/products");
  return { ok: true };
}

/* ---------------------------------- Магазины -------------------------------- */

export async function saveStore(values: unknown, id?: string): Promise<MutationResult> {
  const parsed = storeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const payload = {
    name: parsed.data.name,
    code: parsed.data.code ?? null,
    city: parsed.data.city ?? null,
    address: parsed.data.address ?? null,
    phone: parsed.data.phone ?? null,
    is_active: parsed.data.is_active,
  };

  const { error } = id
    ? await supabase.from("stores").update(payload).eq("id", id)
    : await supabase.from("stores").insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/stores");
  return { ok: true };
}

export async function deleteStore(id: string): Promise<MutationResult> {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/stores");
  return { ok: true };
}

/* -------------------------------- Пользователи ------------------------------ */

export async function createUser(values: unknown): Promise<MutationResult> {
  const parsed = userSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  await requireRole(["admin", "director"]);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error: "Не задан SUPABASE_SERVICE_ROLE_KEY — создание пользователей недоступно",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, role: parsed.data.role },
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Не удалось создать пользователя" };
  }

  // Триггер создаёт профиль сам — здесь дописываем магазин и роль.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({
      id: data.user.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      role: parsed.data.role,
      store_id: parsed.data.store_id ?? null,
      is_active: true,
    });

  if (profileError) return { ok: false, error: profileError.message };

  revalidatePath("/users");
  return { ok: true, id: data.user.id };
}

export async function updateUserProfile(
  id: string,
  values: { role: UserRole; store_id?: string | null; is_active: boolean },
): Promise<MutationResult> {
  const profile = await requireRole(["admin", "director"]);

  if (profile.id === id && values.role !== profile.role) {
    return { ok: false, error: "Нельзя изменить собственную роль" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: values.role,
      store_id: values.store_id ?? null,
      is_active: values.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/users");
  return { ok: true };
}

/** Смена собственного пароля. */
export async function changePassword(password: string): Promise<MutationResult> {
  await requireProfile();
  if (password.length < 8) {
    return { ok: false, error: "Пароль должен быть не короче 8 символов" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
