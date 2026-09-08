"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { createClientRecord, updateClientRecord } from "@/lib/actions/clients";
import {
  CLIENT_SOURCES,
  CLIENT_STATUS_LABELS,
  CLIENT_TYPE_LABELS,
} from "@/lib/constants";
import {
  clientSchema,
  type ClientFormValues,
  type ClientInput,
} from "@/lib/validations";
import type { Client, Profile, Store } from "@/lib/types";

const NONE = "__none__";

interface ClientFormProps {
  client?: Client;
  stores: Pick<Store, "id" | "name">[];
  managers: Pick<Profile, "id" | "full_name">[];
}

export function ClientForm({ client, stores, managers }: ClientFormProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues, unknown, ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? "",
      type: client?.type ?? "company",
      status: client?.status ?? "lead",
      inn: client?.inn ?? undefined,
      phone: client?.phone ?? undefined,
      email: client?.email ?? undefined,
      address: client?.address ?? undefined,
      source: client?.source ?? undefined,
      note: client?.note ?? undefined,
      store_id: client?.store_id ?? undefined,
      manager_id: client?.manager_id ?? undefined,
      discount_percent: client?.discount_percent ?? 0,
    },
  });

  const onSubmit = (values: ClientInput) => {
    startTransition(async () => {
      const result = client
        ? await updateClientRecord(client.id, values)
        : await createClientRecord(values);

      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить клиента");
        return;
      }
      toast.success(client ? "Клиент обновлён" : "Клиент создан");
      router.push(client ? `/clients/${client.id}` : `/clients/${result.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Название / ФИО"
            htmlFor="name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input id="name" placeholder="ООО «СтройДом»" {...register("name")} />
          </Field>

          <Field label="Тип клиента" error={errors.type?.message}>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Статус" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Телефон" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="+7 495 000-00-00" {...register("phone")} />
          </Field>

          <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" placeholder="info@company.ru" {...register("email")} />
          </Field>

          <Field label="ИНН" htmlFor="inn" error={errors.inn?.message}>
            <Input id="inn" placeholder="7701234567" {...register("inn")} />
          </Field>

          <Field
            label="Скидка, %"
            htmlFor="discount_percent"
            error={errors.discount_percent?.message}
            hint="Применяется по умолчанию к новым заказам"
          >
            <Input
              id="discount_percent"
              type="number"
              step="0.5"
              min="0"
              max="50"
              {...register("discount_percent")}
            />
          </Field>

          <Field
            label="Адрес"
            htmlFor="address"
            error={errors.address?.message}
            className="sm:col-span-2"
          >
            <Input id="address" placeholder="Москва, ул. Ленина, 1" {...register("address")} />
          </Field>

          <Field label="Источник" error={errors.source?.message}>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Не указан" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Не указан</SelectItem>
                    {CLIENT_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Магазин" error={errors.store_id?.message}>
            <Controller
              control={control}
              name="store_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Не выбран" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Не выбран</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Ответственный менеджер"
            error={errors.manager_id?.message}
            className="sm:col-span-2"
          >
            <Controller
              control={control}
              name="manager_id"
              render={({ field }) => (
                <Select
                  value={field.value ?? NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Назначить позже" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Назначить позже</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Комментарий"
            htmlFor="note"
            error={errors.note?.message}
            className="sm:col-span-2"
          >
            <Textarea id="note" rows={3} placeholder="Особенности работы, договорённости…" {...register("note")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {client ? "Сохранить" : "Создать клиента"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
