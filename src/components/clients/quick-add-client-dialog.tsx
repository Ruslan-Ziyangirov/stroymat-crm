"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { createClientRecord } from "@/lib/actions/clients";
import { CLIENT_TYPE_LABELS } from "@/lib/constants";

const quickClientSchema = z.object({
  name: z.string().trim().min(2, "Укажите название или ФИО"),
  type: z.enum(["individual", "company"]),
  phone: z.string().trim().optional().or(z.literal("")),
});
type QuickClientInput = z.infer<typeof quickClientSchema>;

export interface QuickClient {
  id: string;
  name: string;
  discount_percent: number;
  bonus_balance: number;
  store_id: string | null;
}

export function QuickAddClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: QuickClient) => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickClientInput>({
    resolver: zodResolver(quickClientSchema),
    defaultValues: { name: "", type: "company", phone: "" },
  });

  const onSubmit = (values: QuickClientInput) => {
    startTransition(async () => {
      const result = await createClientRecord({
        name: values.name,
        type: values.type,
        status: "lead",
        phone: values.phone || undefined,
        discount_percent: 0,
      });
      if (!result.ok || !result.id) {
        toast.error(result.error ?? "Не удалось создать клиента");
        return;
      }
      toast.success("Клиент создан");
      onCreated({
        id: result.id,
        name: values.name,
        discount_percent: 0,
        bonus_balance: 0,
        store_id: null,
      });
      reset();
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый клиент</DialogTitle>
          <DialogDescription>
            Минимум данных, чтобы сразу оформить заказ — остальное можно заполнить позже в
            карточке клиента.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Название / ФИО" htmlFor="quick-name" error={errors.name?.message}>
            <Input id="quick-name" autoFocus placeholder="ООО «СтройДом»" {...register("name")} />
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

          <Field label="Телефон" htmlFor="quick-phone" error={errors.phone?.message}>
            <Input id="quick-phone" placeholder="+7 495 000-00-00" {...register("phone")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Создать и выбрать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
