import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Обновляет сессию Supabase на каждом запросе и закрывает приватные маршруты.
 * В Next.js 16 это соглашение называется proxy (бывший middleware).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
