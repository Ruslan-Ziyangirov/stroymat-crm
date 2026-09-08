import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo width={200} />
      <div>
        <p className="text-primary text-5xl font-bold">404</p>
        <h1 className="mt-2 text-xl font-semibold">Страница не найдена</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Возможно, запись удалили или ссылка устарела.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Вернуться на дашборд</Link>
      </Button>
    </div>
  );
}
