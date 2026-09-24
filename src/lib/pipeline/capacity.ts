import type { createClient } from "@/lib/supabase/server";
import { ACTIVE_DEAL_STAGES } from "@/lib/constants";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Лимит активных сделок на менеджера (методология: менеджеру нельзя давать
 * бесконечное число сделок — сначала доведи/квалифицируй, потом бери новую).
 * Возвращает текст ошибки, если менеджер уже на лимите, иначе null.
 */
export async function assertManagerCapacity(
  supabase: Supabase,
  managerId: string | null | undefined,
  excludeOrderId?: string,
): Promise<string | null> {
  if (!managerId) return null;

  const [{ data: settings }, countRes] = await Promise.all([
    supabase
      .from("pipeline_settings")
      .select("manager_active_deal_limit")
      .eq("id", true)
      .maybeSingle(),
    (() => {
      let query = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", managerId)
        .in("stage", ACTIVE_DEAL_STAGES);
      if (excludeOrderId) query = query.neq("id", excludeOrderId);
      return query;
    })(),
  ]);

  const limit = settings?.manager_active_deal_limit ?? 80;
  const count = countRes.count ?? 0;

  if (count >= limit) {
    return `У менеджера уже ${count} активных сделок из ${limit} допустимых. Сначала доведите часть сделок до продажи или отказа, либо назначьте другого менеджера.`;
  }
  return null;
}
