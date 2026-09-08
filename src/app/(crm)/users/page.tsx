import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { UsersManager, type UserRow } from "@/components/settings/users-manager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getStores } from "@/lib/queries/refs";
import { readEnv } from "@/lib/env";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Пользователи" };

export default async function UsersPage() {
  const profile = await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [profilesRes, clientsRes, ordersRes, stores] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, store:stores(id, name)")
      .order("full_name"),
    supabase.from("clients").select("manager_id"),
    supabase.from("orders").select("manager_id"),
    getStores(),
  ]);

  const profiles = (profilesRes.data ?? []) as unknown as Profile[];
  const clients = (clientsRes.data ?? []) as { manager_id: string | null }[];
  const orders = (ordersRes.data ?? []) as { manager_id: string | null }[];

  const countBy = (list: { manager_id: string | null }[]) => {
    const map = new Map<string, number>();
    for (const item of list) {
      if (!item.manager_id) continue;
      map.set(item.manager_id, (map.get(item.manager_id) ?? 0) + 1);
    }
    return map;
  };

  const clientCounts = countBy(clients);
  const orderCounts = countBy(orders);

  const rows: UserRow[] = profiles.map((item) => ({
    id: item.id,
    full_name: item.full_name,
    email: item.email,
    role: item.role,
    store_id: item.store_id,
    store_name: item.store?.name ?? null,
    is_active: item.is_active,
    clients_count: clientCounts.get(item.id) ?? 0,
    orders_count: orderCounts.get(item.id) ?? 0,
  }));

  const canCreateUsers = Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));

  return (
    <>
      <PageHeader
        title="Пользователи"
        description="Роли определяют доступ: менеджер видит своих клиентов и заказы, руководитель — всю компанию."
      />

      {!canCreateUsers && (
        <Alert className="mb-4">
          <AlertTitle>Создание сотрудников недоступно</AlertTitle>
          <AlertDescription>
            Задайте <code>SUPABASE_SERVICE_ROLE_KEY</code> в переменных окружения, чтобы
            заводить пользователей прямо из CRM. Роли существующих сотрудников меняются и без
            этого ключа.
          </AlertDescription>
        </Alert>
      )}

      <UsersManager data={rows} stores={stores} currentUserId={profile.id} />
    </>
  );
}
