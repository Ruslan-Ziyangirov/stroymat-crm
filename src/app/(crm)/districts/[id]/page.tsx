import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DeleteDistrictButton } from "@/components/districts/delete-district-button";
import { DistrictRadar } from "@/components/charts/monthly-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { DISTRICT_CRITERIA_LABELS, verdictFor } from "@/lib/analytics/district";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DistrictAnalysis, DistrictScores } from "@/lib/types";

export const metadata: Metadata = { title: "Анализ района" };

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("district_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const analysis = data as unknown as DistrictAnalysis;
  const total = Number(analysis.total_score);
  const verdict = verdictFor(total);
  const scores = analysis.scores;
  const inputs = analysis.inputs;

  const radar = (Object.keys(scores) as (keyof DistrictScores)[]).map((key) => ({
    criterion: DISTRICT_CRITERIA_LABELS[key],
    score: scores[key],
  }));

  return (
    <>
      <PageHeader
        title={analysis.name}
        description={`${analysis.city ?? "Город не указан"} · обновлён ${formatDateTime(analysis.updated_at)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/districts/${analysis.id}/edit`}>
                <Pencil className="size-4" />
                Изменить данные
              </Link>
            </Button>
            <DeleteDistrictButton id={analysis.id} name={analysis.name} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className={cn(
            "lg:col-span-1",
            verdict.tone === "good"
              ? "border-emerald-200"
              : verdict.tone === "bad"
                ? "border-red-200"
                : "border-amber-200",
          )}
        >
          <CardHeader>
            <CardTitle>Итоговая оценка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p
              className={cn(
                "text-6xl font-bold tabular-nums",
                verdict.tone === "good"
                  ? "text-emerald-600"
                  : verdict.tone === "mid"
                    ? "text-primary"
                    : "text-destructive",
              )}
            >
              {total}
            </p>
            <p className="text-muted-foreground text-xs">из 100 баллов</p>
            <Progress value={total} className="h-2" />
            <p className="font-medium">{verdict.verdict}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Профиль района по критериям</CardTitle>
          </CardHeader>
          <CardContent>
            <DistrictRadar data={radar} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Баллы по критериям</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {radar.map((item) => (
              <div key={item.criterion}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.criterion}</span>
                  <span className="font-medium tabular-nums">{item.score}</span>
                </div>
                <Progress value={item.score} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Исходные данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Магазинов-конкурентов" value={formatNumber(inputs.competitors)} />
            <Row label="Сила конкурентов" value={`${inputs.competitorStrength} из 5`} />
            <Row label="Уровень цен в районе" value={`${inputs.priceLevel} из 5`} />
            <Row label="Жилая застройка" value={`${formatNumber(inputs.residentialUnits)} кв.`} />
            <Row label="Активных строек" value={formatNumber(inputs.newConstructions)} />
            <Row label="Инфраструктура" value={`${inputs.infrastructure} из 5`} />
            <Row label="Потенциальный спрос" value={`${inputs.demand} из 5`} />
            <Row label="Перспективы развития" value={`${inputs.prospects} из 5`} />
            <Row label="Логистика" value={`${inputs.logistics} из 5`} />
            <Row label="Аренда" value={`${formatMoney(inputs.rentCost)} / мес.`} />
            {inputs.comment && (
              <>
                <Separator />
                <p className="text-muted-foreground">{inputs.comment}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Объяснение оценки</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {analysis.verdict}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Рекомендация</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{analysis.recommendation}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}
