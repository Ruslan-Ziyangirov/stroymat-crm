"use client";

import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deleteOrder } from "@/lib/actions/orders";

export function DeleteOrderButton({ id, number }: { id: string; number: string }) {
  return (
    <ConfirmDelete
      title="Удалить заказ?"
      description={`Заказ ${number} и его состав будут удалены безвозвратно.`}
      action={() => deleteOrder(id)}
      redirectTo="/orders"
    />
  );
}
