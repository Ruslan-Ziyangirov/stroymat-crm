"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { addBonusTransaction } from "@/lib/actions/bonuses";
import { bonusSchema, type BonusFormValues, type BonusInput } from "@/lib/validations";

const TYPES = [
  { value: "accrual", label: "Начислить" },
  { value: "redeem", label: "Списать" },
  { value: "manual", label: "Корректировка" },
] as const;

export function BonusForm({
  clients,
}: {
  clients: { id: string; name: string; bonus_balance: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BonusFormValues, unknown, BonusInput>({
    resolver: zodResolver(bonusSchema),
    defaultValues: { client_id: "", type: "accrual", points: 0, comment: undefined },
  });

  const onSubmit = (values: BonusInput) => {
    startTransition(async () => {
      const result = await addBonusTransaction(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось провести операцию");
        return;
      }
      toast.success("Операция проведена");
      reset({ client_id: values.client_id, type: values.type, points: 0, comment: undefined });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-4">
      <Field label="Клиент" error={errors.client_id?.message} className="sm:col-span-2">
        <Controller
          control={control}
          name="client_id"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите клиента" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} · {client.bonus_balance} б.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Операция" error={errors.type?.message}>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <Field label="Баллы" htmlFor="points" error={errors.points?.message}>
        <Input id="points" type="number" min="1" step="1" {...register("points")} />
      </Field>

      <Field
        label="Комментарий"
        htmlFor="comment"
        error={errors.comment?.message}
        className="sm:col-span-3"
      >
        <Input id="comment" placeholder="Основание операции" {...register("comment")} />
      </Field>

      <div className="flex items-end">
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Провести
        </Button>
      </div>
    </form>
  );
}
