"use client";

import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deleteFinanceUpload } from "@/lib/actions/finance";

export function DeleteFinanceUploadButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDelete
      title="Удалить загрузку?"
      description={`Файл «${name}» и все распознанные строки будут удалены из финансовой отчётности.`}
      action={() => deleteFinanceUpload(id)}
      redirectTo="/finance"
    />
  );
}
