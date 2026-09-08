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
import { upsertPlan } from "@/lib/actions/plans";
import { planSchema, type PlanFormValues, type PlanInput } from "@/lib/validations";
import type { Store } from "@/lib/types";

const COMPANY = "__company__";

interface PlanFormProps {
  stores: Pick<Store, "id" | "name">[];
  defaultMonth: string;
}

export function PlanForm({ stores, defaultMonth }: PlanFormProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlanFormValues, unknown, PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      month: defaultMonth,
      store_id: undefined,
      target_amount: 0,
    },
  });

  const onSubmit = (values: PlanInput) => {
    startTransition(async () => {
      const result = await upsertPlan(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить план");
        return;
      }
      toast.success("План сохранён");
      reset({ month: values.month, store_id: undefined, target_amount: 0 });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-3">
      <Field label="Месяц" htmlFor="month" error={errors.month?.message}>
        <Controller
          control={control}
          name="month"
          render={({ field }) => (
            <Input
              id="month"
              type="month"
              value={field.value ? field.value.slice(0, 7) : ""}
              onChange={(e) => field.onChange(e.target.value ? `${e.target.value}-01` : "")}
            />
          )}
        />
      </Field>

      <Field label="Филиал" error={errors.store_id?.message}>
        <Controller
          control={control}
          name="store_id"
          render={({ field }) => (
            <Select
              value={field.value ?? COMPANY}
              onValueChange={(v) => field.onChange(v === COMPANY ? undefined : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COMPANY}>Компания целиком</SelectItem>
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

      <Field label="Плановая выручка" htmlFor="target_amount" error={errors.target_amount?.message}>
        <div className="flex gap-2">
          <Input
            id="target_amount"
            type="number"
            step="1000"
            min="0"
            {...register("target_amount")}
          />
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </Button>
        </div>
      </Field>
    </form>
  );
}
