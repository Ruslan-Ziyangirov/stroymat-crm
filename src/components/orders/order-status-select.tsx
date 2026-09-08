"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deleteOrder, updateOrderStatus } from "@/lib/actions/orders";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";

export function OrderStatusSelect({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onChange = (value: string) => {
    startTransition(async () => {
      const result = await updateOrderStatus(id, value as OrderStatus);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось изменить статус");
        return;
      }
      toast.success(`Статус: ${ORDER_STATUS_LABELS[value as OrderStatus]}`);
      router.refresh();
    });
  };

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
