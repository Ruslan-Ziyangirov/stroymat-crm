"use client";

import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deleteClientRecord } from "@/lib/actions/clients";

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDelete
      title="Удалить клиента?"
      description={`Карточка «${name}» и вся история работы будут удалены безвозвратно. Клиента с заказами удалить нельзя.`}
      action={() => deleteClientRecord(id)}
      redirectTo="/clients"
    />
  );
}
