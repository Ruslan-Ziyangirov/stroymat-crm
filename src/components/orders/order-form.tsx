"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import {
  QuickAddClientDialog,
  type QuickClient,
} from "@/components/clients/quick-add-client-dialog";
import { createOrder, updateOrder } from "@/lib/actions/orders";
import { UNITS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import {
  orderSchema,
  type OrderFormValues,
  type OrderInput,
} from "@/lib/validations";
import type { Order, Product, Profile, Store } from "@/lib/types";

const NONE = "__none__";
const NEW_CLIENT = "__new_client__";

interface OrderFormProps {
  order?: Order;
  clients: { id: string; name: string; discount_percent: number; bonus_balance: number; store_id: string | null }[];
  products: Pick<Product, "id" | "name" | "unit" | "price" | "sku" | "category">[];
  stores: Pick<Store, "id" | "name">[];
  managers: Pick<Profile, "id" | "full_name">[];
  defaultClientId?: string;
}

export function OrderForm({
  order,
  clients,
  products,
  stores,
  managers,
  defaultClientId,
}: OrderFormProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [clientList, setClientList] = React.useState(clients);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OrderFormValues, unknown, OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      client_id: order?.client_id ?? defaultClientId ?? "",
      manager_id: order?.manager_id ?? undefined,
      store_id: order?.store_id ?? undefined,
      discount_percent: order?.discount_percent ?? 0,
      bonus_used: order?.bonus_used ?? 0,
      delivery_address: order?.delivery_address ?? undefined,
      delivery_date: order?.delivery_date ?? undefined,
      comment: order?.comment ?? undefined,
      items: order?.items?.length
        ? order.items.map((item) => ({
            product_id: item.product_id ?? undefined,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            price: item.price,
          }))
        : [{ product_id: undefined, name: "", unit: "шт", quantity: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watched = useWatch({ control });
  const items = (watched.items ?? []) as { quantity?: unknown; price?: unknown }[];
  const itemsTotal = items.reduce(
    (sum, item) => sum + Number(item?.quantity ?? 0) * Number(item?.price ?? 0),
    0,
  );
  const discount = Number(watched.discount_percent ?? 0);
  const bonusUsed = Number(watched.bonus_used ?? 0);
  const total = Math.max(itemsTotal * (1 - discount / 100) - bonusUsed, 0);

  const selectedClient = clientList.find((c) => c.id === watched.client_id);

  const handleClientCreated = (client: QuickClient) => {
    setClientList((prev) => [client, ...prev]);
    setValue("client_id", client.id);
  };

  /** Подставляем цену и единицу измерения из номенклатуры. */
  const applyProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setValue(`items.${index}.product_id`, product.id);
    setValue(`items.${index}.name`, product.name);
    setValue(`items.${index}.unit`, product.unit);
    setValue(`items.${index}.price`, product.price);
  };

  const onSubmit = (values: OrderInput) => {
    startTransition(async () => {
      const result = order ? await updateOrder(order.id, values) : await createOrder(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить заказ");
        return;
      }
      toast.success(order ? "Заказ обновлён" : "Заказ создан");
      router.push(`/orders/${result.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Основное</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Клиент"
              error={errors.client_id?.message}
              className="sm:col-span-2"
              hint={
                selectedClient
                  ? `Скидка клиента: ${selectedClient.discount_percent} % · бонусы: ${formatMoney(selectedClient.bonus_balance)}`
                  : undefined
              }
            >
              <Controller
                control={control}
                name="client_id"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => {
                      if (value === NEW_CLIENT) {
                        setQuickAddOpen(true);
                        return;
                      }
                      field.onChange(value);
                      const client = clientList.find((c) => c.id === value);
                      if (client && !order) {
                        setValue("discount_percent", client.discount_percent);
                        if (client.store_id) setValue("store_id", client.store_id);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите клиента" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_CLIENT} className="text-primary font-medium">
                        <UserPlus className="size-3.5" />
                        Добавить нового клиента
                      </SelectItem>
                      <SelectSeparator />
                      {clientList.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Ответственный менеджер" error={errors.manager_id?.message}>
              <Controller
                control={control}
                name="manager_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? undefined : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Я" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Назначить меня</SelectItem>
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
              label="Дата доставки"
              htmlFor="delivery_date"
              error={errors.delivery_date?.message}
            >
              <Input id="delivery_date" type="date" {...register("delivery_date")} />
            </Field>

            <Field
              label="Адрес доставки"
              htmlFor="delivery_address"
              error={errors.delivery_address?.message}
              className="sm:col-span-2"
            >
              <Input
                id="delivery_address"
                placeholder="Объект, улица, дом"
                {...register("delivery_address")}
              />
            </Field>

            <Field
              label="Комментарий"
              htmlFor="comment"
              error={errors.comment?.message}
              className="sm:col-span-2"
            >
              <Textarea id="comment" rows={2} {...register("comment")} />
            </Field>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Расчёт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Скидка, %"
              htmlFor="discount_percent"
              error={errors.discount_percent?.message}
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
              label="Списать бонусов"
              htmlFor="bonus_used"
              error={errors.bonus_used?.message}
              hint={
                selectedClient
                  ? `Доступно: ${formatMoney(selectedClient.bonus_balance)}`
                  : "Выберите клиента"
              }
            >
              <Input
                id="bonus_used"
                type="number"
                step="1"
                min="0"
                {...register("bonus_used")}
              />
            </Field>

            <Separator />

            <dl className="space-y-2 text-sm">
              <Line label="Позиции" value={formatMoney(itemsTotal)} />
              <Line label={`Скидка ${discount} %`} value={`− ${formatMoney((itemsTotal * discount) / 100)}`} />
              <Line label="Бонусами" value={`− ${formatMoney(bonusUsed)}`} />
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="font-semibold">Итого</dt>
                <dd className="text-primary text-xl font-bold tabular-nums">
                  {formatMoney(total)}
                </dd>
              </div>
              <p className="text-muted-foreground text-xs">
                Бонусов будет начислено при переходе сделки на этап «Продажа»: {formatMoney(total * 0.01)}
              </p>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Состав заказа</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ product_id: undefined, name: "", unit: "шт", quantity: 1, price: 0 })
            }
          >
            <Plus className="size-4" />
            Добавить позицию
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.items?.message && (
            <p className="text-destructive text-sm">{errors.items.message}</p>
          )}

          {fields.map((field, index) => {
            const rowTotal =
              Number(items[index]?.quantity ?? 0) * Number(items[index]?.price ?? 0);
            return (
              <div
                key={field.id}
                className="bg-muted/30 grid gap-3 rounded-lg border p-3 md:grid-cols-12"
              >
                <div className="md:col-span-4">
                  <label className="text-muted-foreground mb-1 block text-xs">
                    Из номенклатуры
                  </label>
                  <Select onValueChange={(value) => applyProduct(index, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выбрать товар" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} · {formatMoney(product.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4">
                  <label className="text-muted-foreground mb-1 block text-xs">
                    Наименование
                  </label>
                  <Input placeholder="Наименование" {...register(`items.${index}.name`)} />
                  {errors.items?.[index]?.name && (
                    <p className="text-destructive mt-1 text-xs">
                      {errors.items[index]?.name?.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-1">
                  <label className="text-muted-foreground mb-1 block text-xs">Ед.</label>
                  <Controller
                    control={control}
                    name={`items.${index}.unit`}
                    render={({ field: unitField }) => (
                      <Select value={unitField.value} onValueChange={unitField.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-muted-foreground mb-1 block text-xs">Кол-во</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    {...register(`items.${index}.quantity`)}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-muted-foreground mb-1 block text-xs">Цена</label>
                  <Input type="number" step="0.01" min="0" {...register(`items.${index}.price`)} />
                </div>

                <div className="flex items-end justify-between gap-2 md:col-span-1">
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">Сумма</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(rowTotal)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {order ? "Сохранить заказ" : "Создать заказ"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>

      <QuickAddClientDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={handleClientCreated}
      />
    </form>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
