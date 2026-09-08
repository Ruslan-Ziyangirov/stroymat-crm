import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { getManagers, getStores } from "@/lib/queries/refs";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Редактирование клиента" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [{ data }, stores, managers] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    getStores(),
    getManagers(),
  ]);

  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Редактирование клиента" description={(data as Client).name} />
      <ClientForm client={data as Client} stores={stores} managers={managers} />
    </div>
  );
}
