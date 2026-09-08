import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "stroymat-crm",
    supabase: isSupabaseConfigured() ? "configured" : "not-configured",
    time: new Date().toISOString(),
  });
}
