import type { Metadata } from "next";
import Link from "next/link";
import { MapPinned, Plus } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { verdictFor } from "@/lib/analytics/district";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DistrictAnalysis } from "@/lib/types";

export const metadata: Metadata = { title: "Анализ районов" };

export default async function DistrictsPage() {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("district_analyses")
    .select("*")
    .order("total_score", { ascending: false });

  const analyses = (data ?? []) as unknown as DistrictAnalysis[];

  return (
    <>
      <PageHeader
        title="Анализ района для открытия магазина"
        description="Заполните данные по району — сервис оценит потенциал и объяснит, насколько выгодно там открываться."
        actions={
          <Button asChild>
            <Link href="/districts/new">
              <Plus className="size-4" />
              Новый анализ
            </Link>
          </Button>
        }
      />

      {analyses.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analyses.map((analysis) => {
            const verdict = verdictFor(Number(analysis.total_score));
            return (
              <Link key={analysis.id} href={`/districts/${analysis.id}`}>
                <Card className="hover:border-primary/50 h-full transition-colors">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{analysis.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {analysis.city ?? "—"} · {formatDate(analysis.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 font-semibold",
                          verdict.tone === "good"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : verdict.tone === "mid"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-red-200 bg-red-50 text-red-700",
                        )}
                      >
                        {Number(analysis.total_score)} / 100
                      </Badge>
                    </div>

                    <Progress value={Number(analysis.total_score)} className="h-2" />

                    <p className="text-muted-foreground line-clamp-3 text-sm">
                      {analysis.verdict}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MapPinned className="text-muted-foreground size-8" />
            <p className="font-medium">Анализов пока нет</p>
            <p className="text-muted-foreground max-w-md text-sm">
              Заполните данные по району: конкуренты, уровень цен, жилая застройка, новые
              стройки, инфраструктура и спрос — система рассчитает оценку потенциала.
            </p>
            <Button asChild>
              <Link href="/districts/new">Создать первый анализ</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
