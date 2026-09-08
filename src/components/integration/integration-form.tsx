"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/common/field";
import {
  testIntegrationConnection,
  updateIntegrationSettings,
} from "@/lib/actions/integration";
import {
  integrationSchema,
  type IntegrationFormValues,
  type IntegrationInput,
} from "@/lib/validations";
import type { IntegrationSettings } from "@/lib/types";

const TOGGLES = [
  {
    name: "sync_clients" as const,
    label: "Синхронизация клиентов",
    hint: "Карточки клиентов и их реквизиты",
  },
  {
    name: "sync_orders" as const,
    label: "Обмен заказами",
    hint: "Состав, суммы и статусы заказов",
  },
  {
    name: "sync_bonuses" as const,
    label: "Синхронизация бонусов",
    hint: "Начисления и списания баллов",
  },
];

export function IntegrationForm({ settings }: { settings: IntegrationSettings }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [testing, startTesting] = React.useTransition();

  const { register, control, handleSubmit, formState: { errors } } = useForm<
    IntegrationFormValues,
    unknown,
    IntegrationInput
  >({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      is_enabled: settings.is_enabled,
      base_url: settings.base_url ?? undefined,
      username: settings.username ?? undefined,
      sync_clients: settings.sync_clients,
      sync_orders: settings.sync_orders,
      sync_bonuses: settings.sync_bonuses,
    },
  });

  const onSubmit = (values: IntegrationInput) => {
    startTransition(async () => {
      const result = await updateIntegrationSettings(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить настройки");
        return;
      }
      toast.success("Настройки интеграции сохранены");
      router.refresh();
    });
  };

  const onTest = () => {
    startTesting(async () => {
      const result = await testIntegrationConnection();
      if (!result.ok) {
        toast.error(result.error ?? "Соединение не установлено");
        return;
      }
      toast.success("База 1С отвечает");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>Параметры обмена</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Controller
            control={control}
            name="is_enabled"
            render={({ field }) => (
              <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">Интеграция включена</span>
                  <span className="text-muted-foreground block text-xs">
                    Пока выключено, HTTP-методы обмена отвечают кодом 409.
                  </span>
                </span>
              </label>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Адрес базы 1С"
              htmlFor="base_url"
              error={errors.base_url?.message}
              hint="Например: https://1c.stroymat.local/base/hs/crm"
            >
              <Input id="base_url" placeholder="https://…" {...register("base_url")} />
            </Field>
            <Field
              label="Пользователь 1С"
              htmlFor="username"
              error={errors.username?.message}
              hint="Пароль хранится на стороне 1С — CRM его не запрашивает"
            >
              <Input id="username" placeholder="crm_exchange" {...register("username")} />
            </Field>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Что синхронизируем</Label>
            {TOGGLES.map((toggle) => (
              <Controller
                key={toggle.name}
                control={control}
                name={toggle.name}
                render={({ field }) => (
                  <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">{toggle.label}</span>
                      <span className="text-muted-foreground block text-xs">
                        {toggle.hint}
                      </span>
                    </span>
                  </label>
                )}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Сохранить настройки
            </Button>
            <Button type="button" variant="outline" onClick={onTest} disabled={testing}>
              {testing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PlugZap className="size-4" />
              )}
              Проверить соединение
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
