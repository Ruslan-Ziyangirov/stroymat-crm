"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { addClientEvent } from "@/lib/actions/clients";
import {
  clientEventSchema,
  type ClientEventFormValues,
  type ClientEventInput,
} from "@/lib/validations";

const TYPES: { value: ClientEventInput["type"]; label: string }[] = [
  { value: "note", label: "Заметка" },
  { value: "call", label: "Звонок" },
  { value: "meeting", label: "Встреча" },
  { value: "bonus", label: "Бонусы" },
];

export function AddEventForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientEventFormValues, unknown, ClientEventInput>({
    resolver: zodResolver(clientEventSchema),
    defaultValues: { client_id: clientId, type: "note", title: "", description: undefined },
  });

  const onSubmit = (values: ClientEventInput) => {
    startTransition(async () => {
      const result = await addClientEvent(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось добавить запись");
        return;
      }
      toast.success("Запись добавлена в историю");
      reset({ client_id: clientId, type: values.type, title: "", description: undefined });
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="flex gap-2">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-40">
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
        <Input placeholder="Тема записи" className="flex-1" {...register("title")} />
      </div>
      {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
      <Textarea rows={2} placeholder="Подробности (необязательно)" {...register("description")} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Добавить в историю
      </Button>
    </form>
  );
}
