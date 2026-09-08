"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validations";

export function LoginForm({
  redirectTo,
  disabled,
}: {
  redirectTo?: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signIn(values, redirectTo);
      if (result && !result.ok) setServerError(result.error ?? "Не удалось войти");
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Рабочий e-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="manager@stroymat.ru"
          disabled={disabled}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-destructive text-xs">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          disabled={disabled}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-destructive text-xs">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending || disabled}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Войти
      </Button>
    </form>
  );
}
