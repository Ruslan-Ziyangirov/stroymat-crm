"use client";

import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deleteDistrict } from "@/lib/actions/districts";

export function DeleteDistrictButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDelete
      title="Удалить анализ?"
      description={`Анализ района «${name}» будет удалён безвозвратно.`}
      action={() => deleteDistrict(id)}
      redirectTo="/districts"
    />
  );
}
