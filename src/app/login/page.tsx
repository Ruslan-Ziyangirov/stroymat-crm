import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { LoginForm } from "@/app/login/login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo width={220} priority />
        </div>

        <Card>
          <CardContent className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight">Вход в систему</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Используйте рабочую учётную запись
              </p>
            </div>

            {!configured && (
              <Alert>
                <TriangleAlert className="size-4" />
                <AlertTitle>Supabase не настроен</AlertTitle>
                <AlertDescription>
                  Заполните <code>NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
                  <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> в <code>.env.local</code>,
                  затем перезапустите приложение.
                </AlertDescription>
              </Alert>
            )}

            <LoginForm redirectTo={redirect} disabled={!configured} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          CRM-система СТРОЙМАТ · внутренний доступ
        </p>
      </div>
    </div>
  );
}
