"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { uploadReport } from "@/lib/actions/uploads";
import type { Store } from "@/lib/types";

const NONE = "__none__";

export function UploadForm({ stores }: { stores: Pick<Store, "id" | "name">[] }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [storeId, setStoreId] = React.useState(NONE);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (storeId !== NONE) formData.set("store_id", storeId);

    startTransition(async () => {
      const result = await uploadReport(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось загрузить отчёт");
        return;
      }
      toast.success("Отчёт загружен и разобран");
      formRef.current?.reset();
      router.push(`/uploads/${result.id}`);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Загрузить отчёт</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Файл отчёта"
            htmlFor="file"
            hint="Excel (.xlsx) или CSV. Колонки: дата, клиент, номенклатура, количество, сумма."
            className="sm:col-span-2"
          >
            <Input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt"
              required
              disabled={pending}
            />
          </Field>

          <Field label="Магазин" hint="Необязательно">
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Не указывать</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileUp className="size-4" />
              )}
              Загрузить и разобрать
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
