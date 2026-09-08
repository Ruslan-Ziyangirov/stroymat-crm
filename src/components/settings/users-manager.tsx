"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/common/field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser, updateUserProfile } from "@/lib/actions/settings";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { userSchema, type UserFormValues, type UserInput } from "@/lib/validations";
import type { Store, UserRole } from "@/lib/types";

const NONE = "__none__";

export interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  store_id: string | null;
  store_name: string | null;
  is_active: boolean;
  clients_count: number;
  orders_count: number;
}

export function UsersManager({
  data,
  stores,
  currentUserId,
}: {
  data: UserRow[];
  stores: Pick<Store, "id" | "name">[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const onRoleChange = async (user: UserRow, role: UserRole) => {
    const result = await updateUserProfile(user.id, {
      role,
      store_id: user.store_id,
      is_active: user.is_active,
    });
    if (!result.ok) toast.error(result.error ?? "Не удалось изменить роль");
    else {
      toast.success("Роль обновлена");
      router.refresh();
    }
  };

  const onStoreChange = async (user: UserRow, storeId: string | null) => {
    const result = await updateUserProfile(user.id, {
      role: user.role,
      store_id: storeId,
      is_active: user.is_active,
    });
    if (!result.ok) toast.error(result.error ?? "Не удалось изменить магазин");
    else {
      toast.success("Магазин обновлён");
      router.refresh();
    }
  };

  const onToggleActive = async (user: UserRow) => {
    const result = await updateUserProfile(user.id, {
      role: user.role,
      store_id: user.store_id,
      is_active: !user.is_active,
    });
    if (!result.ok) toast.error(result.error ?? "Не удалось изменить доступ");
    else {
      toast.success(user.is_active ? "Доступ приостановлен" : "Доступ восстановлен");
      router.refresh();
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Добавить сотрудника
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый сотрудник</DialogTitle>
            </DialogHeader>
            <NewUserForm
              stores={stores}
              onDone={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.map((user) => (
          <Card key={user.id}>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-semibold">
                    {initials(user.full_name || user.email || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {user.full_name || "Без имени"}
                    {user.id === currentUserId && (
                      <span className="text-muted-foreground ml-2 text-xs">это вы</span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                </div>
                {user.is_active ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    Активен
                  </Badge>
                ) : (
                  <Badge variant="outline">Отключён</Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Роль</p>
                  <Select
                    value={user.role}
                    onValueChange={(value) => onRoleChange(user, value as UserRole)}
                    disabled={user.id === currentUserId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Магазин</p>
                  <Select
                    value={user.store_id ?? NONE}
                    onValueChange={(value) =>
                      onStoreChange(user, value === NONE ? null : value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Не привязан</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>
                  Клиентов: {user.clients_count} · заказов: {user.orders_count}
                </span>
                {user.id !== currentUserId && (
                  <Button variant="ghost" size="sm" onClick={() => onToggleActive(user)}>
                    {user.is_active ? "Отключить" : "Включить"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function NewUserForm({
  stores,
  onDone,
}: {
  stores: Pick<Store, "id" | "name">[];
  onDone: () => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormValues, unknown, UserInput>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
      role: "manager",
      store_id: undefined,
    },
  });

  const onSubmit = (values: UserInput) => {
    startTransition(async () => {
      const result = await createUser(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось создать сотрудника");
        return;
      }
      toast.success("Сотрудник создан");
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field label="ФИО" htmlFor="u-name" error={errors.full_name?.message}>
        <Input id="u-name" placeholder="Иванов Иван" {...register("full_name")} />
      </Field>
      <Field label="Рабочий e-mail" htmlFor="u-email" error={errors.email?.message}>
        <Input id="u-email" type="email" {...register("email")} />
      </Field>
      <Field
        label="Пароль"
        htmlFor="u-password"
        error={errors.password?.message}
        hint="Сотрудник сможет сменить его после первого входа"
      >
        <Input id="u-password" type="text" {...register("password")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Роль" error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Не привязан</SelectItem>
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
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Создать
        </Button>
      </DialogFooter>
    </form>
  );
}
