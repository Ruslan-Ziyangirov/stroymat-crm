"use client";

import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deletePlan } from "@/lib/actions/plans";

export function DeletePlanButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmDelete
      title="Удалить план?"
      description={`План «${label}» будет удалён без возможности восстановления.`}
      action={() => deletePlan(id)}
    />
  );
}
