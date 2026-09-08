import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { getManagers, getStores } from "@/lib/queries/refs";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Новый клиент" };

export default async function NewClientPage() {
  await requireProfile();
  const [stores, managers] = await Promise.all([getStores(), getManagers()]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Новый клиент"
        description="Заполните карточку — историю работы система начнёт вести автоматически."
      />
      <ClientForm stores={stores} managers={managers} />
    </div>
  );
}
