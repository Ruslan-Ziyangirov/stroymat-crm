"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type CrmColumnDef } from "@/components/common/data-table";
import { Field } from "@/components/common/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { deleteProduct, saveProduct } from "@/lib/actions/settings";
import { formatMoney } from "@/lib/format";
import {
  productSchema,
  type ProductFormValues,
  type ProductInput,
} from "@/lib/validations";
import type { Product } from "@/lib/types";

export interface ProductRow extends Record<string, unknown> {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  price: number;
  is_active: boolean;
}

export function ProductsManager({ data }: { data: ProductRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ProductRow | null>(null);
  const [open, setOpen] = React.useState(false);

  const columns: CrmColumnDef<ProductRow>[] = React.useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Наименование",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-xs">
              {row.original.sku ?? "без артикула"}
              {row.original.category ? ` · ${row.original.category}` : ""}
            </p>
          </div>
        ),
      },
      { accessorKey: "unit", header: "Ед." },
      {
        accessorKey: "price",
        header: "Цена",
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatMoney(row.original.price, 2)}</span>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Статус",
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Активен
            </Badge>
          ) : (
            <Badge variant="outline">Скрыт</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditing(row.original);
                setOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                const result = await deleteProduct(row.original.id);
                if (!result.ok) toast.error(result.error ?? "Не удалось удалить");
                else {
                  toast.success("Товар удалён");
                  router.refresh();
                }
              }}
            >
              <Trash2 className="text-destructive size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKeys={["name", "sku", "category"]}
        searchPlaceholder="Поиск по наименованию, артикулу, категории…"
        emptyMessage="Номенклатура пуста"
        toolbar={
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
                Добавить товар
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Редактирование товара" : "Новый товар"}</DialogTitle>
              </DialogHeader>
              <ProductFormFields
                product={editing}
                onDone={() => {
                  setOpen(false);
                  setEditing(null);
                  router.refresh();
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />
    </>
  );
}

function ProductFormFields({
  product,
  onDone,
}: {
  product: ProductRow | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? undefined,
      category: product?.category ?? undefined,
      unit: product?.unit ?? "шт",
      price: product?.price ?? 0,
      is_active: product?.is_active ?? true,
    },
  });

  const onSubmit = (values: ProductInput) => {
    startTransition(async () => {
      const result = await saveProduct(values, product?.id);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить");
        return;
      }
      toast.success(product ? "Товар обновлён" : "Товар добавлен");
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="Наименование" htmlFor="p-name" error={errors.name?.message}>
        <Input id="p-name" {...register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Артикул" htmlFor="p-sku" error={errors.sku?.message}>
          <Input id="p-sku" {...register("sku")} />
        </Field>
        <Field label="Категория" htmlFor="p-category" error={errors.category?.message}>
          <Input id="p-category" {...register("category")} />
        </Field>
        <Field label="Единица" htmlFor="p-unit" error={errors.unit?.message}>
          <Input id="p-unit" {...register("unit")} />
        </Field>
        <Field label="Цена, ₽" htmlFor="p-price" error={errors.price?.message}>
          <Input id="p-price" type="number" step="0.01" min="0" {...register("price")} />
        </Field>
      </div>
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
        Активен (доступен для выбора в заказах)
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

export type { Product };
