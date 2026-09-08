"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteStore, saveStore } from "@/lib/actions/settings";
import { formatMoney, formatNumber } from "@/lib/format";
import { storeSchema, type StoreFormValues, type StoreInput } from "@/lib/validations";

export interface StoreRow {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  orders_count: number;
  orders_total: number;
}

export function StoresManager({ data }: { data: StoreRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<StoreRow | null>(null);
  const [open, setOpen] = React.useState(false);

  const onDelete = async (store: StoreRow) => {
    const result = await deleteStore(store.id);
    if (!result.ok) toast.error(result.error ?? "Не удалось удалить");
    else {
      toast.success("Магазин удалён");
      router.refresh();
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4" />
              Добавить магазин
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Редактирование магазина" : "Новый магазин"}</DialogTitle>
            </DialogHeader>
            <StoreFormFields
              store={editing}
              onDone={() => {
                setOpen(false);
                setEditing(null);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((store) => (
          <Card key={store.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{store.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {store.code ?? "без кода"} · {store.city ?? "город не указан"}
                  </p>
                </div>
                {store.is_active ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    Работает
                  </Badge>
                ) : (
                  <Badge variant="outline">Закрыт</Badge>
                )}
              </div>

              <div className="text-muted-foreground space-y-1 text-sm">
                {store.address && <p>{store.address}</p>}
                {store.phone && <p>{store.phone}</p>}
              </div>

              <div className="bg-muted/40 grid grid-cols-2 gap-2 rounded-lg p-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Заказов</p>
                  <p className="font-semibold tabular-nums">
                    {formatNumber(store.orders_count)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Выручка</p>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(store.orders_total)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(store);
                    setOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                  Изменить
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(store)}>
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {!data.length && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="text-muted-foreground py-12 text-center text-sm">
              Магазины ещё не заведены
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function StoreFormFields({
  store,
  onDone,
}: {
  store: StoreRow | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StoreFormValues, unknown, StoreInput>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: store?.name ?? "",
      code: store?.code ?? undefined,
      city: store?.city ?? undefined,
      address: store?.address ?? undefined,
      phone: store?.phone ?? undefined,
      is_active: store?.is_active ?? true,
    },
  });

  const onSubmit = (values: StoreInput) => {
    startTransition(async () => {
      const result = await saveStore(values, store?.id);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить");
        return;
      }
      toast.success(store ? "Магазин обновлён" : "Магазин добавлен");
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Название" htmlFor="s-name" error={errors.name?.message}>
        <Input id="s-name" placeholder="СТРОЙМАТ — Центральный" {...register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Код" htmlFor="s-code" error={errors.code?.message}>
          <Input id="s-code" placeholder="ST-01" {...register("code")} />
        </Field>
        <Field label="Город" htmlFor="s-city" error={errors.city?.message}>
          <Input id="s-city" {...register("city")} />
        </Field>
      </div>
      <Field label="Адрес" htmlFor="s-address" error={errors.address?.message}>
        <Input id="s-address" {...register("address")} />
      </Field>
      <Field label="Телефон" htmlFor="s-phone" error={errors.phone?.message}>
        <Input id="s-phone" {...register("phone")} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Checkbox
              checked={Boolean(field.value)}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        Магазин работает
      </label>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Сохранить
        </Button>
      </DialogFooter>
    </form>
  );
}
