"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {error.message || "Не удалось загрузить данные. Попробуйте обновить страницу."}
      </p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
