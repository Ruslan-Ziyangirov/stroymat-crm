import { createClient } from "@/lib/supabase/server";
import type { MonthlyPlan, Product, Profile, Store } from "@/lib/types";

/** Первое число текущего месяца, YYYY-MM-DD. */
export function currentMonthISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** Планы за месяц: общий по компании (store_id = null) и по филиалам. */
export async function getMonthlyPlans(month: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_plans")
    .select("id, month, store_id, target_amount, created_by, created_at, updated_at")
    .eq("month", month);
  return (data ?? []) as MonthlyPlan[];
}

export async function getAllPlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_plans")
    .select("id, month, store_id, target_amount, created_by, created_at, updated_at, store:stores(id, name)")
    .order("month", { ascending: false });
  return (data ?? []) as unknown as MonthlyPlan[];
}

export async function getStores() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as Pick<Store, "id" | "name">[];
}

export async function getManagers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");
  return (data ?? []) as Pick<Profile, "id" | "full_name">[];
}

export async function getProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, unit, price, sku, category")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as Pick<
    Product,
    "id" | "name" | "unit" | "price" | "sku" | "category"
  >[];
}

export async function getClientOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name, discount_percent, bonus_balance, store_id")
    .order("name");
  return (data ?? []) as {
    id: string;
    name: string;
    discount_percent: number;
    bonus_balance: number;
    store_id: string | null;
  }[];
}
