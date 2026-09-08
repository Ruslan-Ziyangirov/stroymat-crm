"use client";

import { ConfirmDelete } from "@/components/common/confirm-delete";
import { deleteUpload } from "@/lib/actions/uploads";

export function DeleteUploadButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmDelete
      title="Удалить загрузку?"
      description={`Файл «${name}» и все распознанные строки будут удалены из общей отчётности.`}
      action={() => deleteUpload(id)}
      redirectTo="/uploads"
    />
  );
}
