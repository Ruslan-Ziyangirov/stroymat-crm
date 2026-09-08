import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/** Текущий профиль или null. Кэшируется в рамках одного запроса. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, store:stores(id, name)")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) {
    return {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string) ?? user.email ?? "",
      email: user.email ?? null,
      phone: null,
      role: "manager",
      store_id: null,
      is_active: true,
      created_at: user.created_at,
      store: null,
    };
  }

  return data as Profile;
});

/** Профиль или редирект на /login. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Профиль с проверкой роли. */
export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/dashboard?denied=1");
  return profile;
}

export function isPrivileged(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "director";
}
