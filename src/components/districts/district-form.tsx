"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { createDistrict, updateDistrict } from "@/lib/actions/districts";
import {
  DISTRICT_CRITERIA_LABELS,
  missingDistrictInputs,
  scoreDistrict,
  totalScore,
  verdictFor,
} from "@/lib/analytics/district";
import {
  districtSchema,
  type DistrictFormValues,
  type DistrictInput,
} from "@/lib/validations";
import type { DistrictAnalysis, DistrictInputs, DistrictScores } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DistrictForm({ analysis }: { analysis?: DistrictAnalysis }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const inputs = analysis?.inputs;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DistrictFormValues, unknown, DistrictInput>({
    resolver: zodResolver(districtSchema),
    defaultValues: {
      name: analysis?.name ?? "",
      city: analysis?.city ?? undefined,
      population: inputs?.population,
      buildingType: inputs?.buildingType ?? "mixed",
      competitorsCount: inputs?.competitorsCount ?? 0,
      strongCompetitors: inputs?.strongCompetitors ?? 0,
      accessibility: inputs?.accessibility ?? "yes",
      rentCost: inputs?.rentCost,
      ownStoreNearby: inputs?.ownStoreNearby ?? "no",
      comment: inputs?.comment ?? undefined,
    },
  });

  const watched = useWatch({ control });

  // Живой пересчёт оценки прямо во время заполнения.
  const preview: DistrictInputs = {
    population: watched.population === "" || watched.population == null ? undefined : Number(watched.population),
    buildingType: watched.buildingType ?? "mixed",
    competitorsCount: Number(watched.competitorsCount ?? 0),
    strongCompetitors: Number(watched.strongCompetitors ?? 0),
    accessibility: watched.accessibility ?? "yes",
    rentCost: watched.rentCost === "" || watched.rentCost == null ? undefined : Number(watched.rentCost),
    ownStoreNearby: watched.ownStoreNearby ?? "no",
  };
  const scores = scoreDistrict(preview);
  const total = totalScore(scores);
  const verdict = verdictFor(total);
  const missing = missingDistrictInputs(preview);

  const onSubmit = (values: DistrictInput) => {
    startTransition(async () => {
      const result = analysis
        ? await updateDistrict(analysis.id, values)
        : await createDistrict(values);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить анализ");
        return;
      }
      toast.success("Анализ сохранён");
      router.push(`/districts/${result.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Район</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Название района" htmlFor="name" error={errors.name?.message}>
              <Input id="name" placeholder="Северное Бутово" {...register("name")} />
            </Field>
            <Field label="Город" htmlFor="city" error={errors.city?.message}>
              <Input id="city" placeholder="Москва" {...register("city")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Спрос и застройка</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Население зоны охвата, чел."
              htmlFor="population"
              error={errors.population?.message}
              hint="Число жителей населённого пункта и соседних посёлков, откуда удобно доехать. Оставьте пустым, если точных данных нет — балл усреднится, а не обнулится."
              source="Росстат — данные по муниципальным образованиям; соседние пункты — по карте"
              className="sm:col-span-2"
            >
              <Input
                id="population"
                type="number"
                min="0"
                placeholder="Неизвестно"
                {...register("population")}
              />
            </Field>

            <Field
              label="Тип застройки"
              hint="Ориентир для выбора ассортимента: в частном секторе выше спрос на пиломатериалы и кровлю"
              source="Визуально по карте"
            >
              <Controller
                control={control}
                name="buildingType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Преимущественно частные дома</SelectItem>
                      <SelectItem value="apartments">Многоквартирные дома</SelectItem>
                      <SelectItem value="mixed">Смешанная</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Конкуренты</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Конкурентов в доступности"
              htmlFor="competitorsCount"
              error={errors.competitorsCount?.message}
              hint="Строительных магазинов в пределах выбранного времени поездки, включая соседний район, если до него легко доехать"
              source="Поиск организаций и маршрутов в Яндекс Картах"
            >
              <Input
                id="competitorsCount"
                type="number"
                min="0"
                {...register("competitorsCount")}
              />
            </Field>
            <Field
              label="Из них сильных"
              htmlFor="strongCompetitors"
              error={errors.strongCompetitors?.message}
              hint="Крупные сети/гипермаркеты среди конкурентов — балл снижается пропорционально их доле, а не штуками"
            >
              <Input
                id="strongCompetitors"
                type="number"
                min="0"
                {...register("strongCompetitors")}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Точка</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Доступность точки"
              hint="Удобно ли подъехать, припарковаться и загрузить стройматериалы"
              source="Карта и короткий осмотр помещения"
            >
              <Controller
                control={control}
                name="accessibility"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Да</SelectItem>
                      <SelectItem value="partial">Частично</SelectItem>
                      <SelectItem value="no">Нет</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Аренда помещения, ₽/мес."
              htmlFor="rentCost"
              error={errors.rentCost?.message}
              hint="Оставьте пустым, если помещение ещё не выбрано"
              source="Объявление или предложение арендодателя"
            >
              <Input
                id="rentCost"
                type="number"
                min="0"
                step="1000"
                placeholder="Не выбрано"
                {...register("rentCost")}
              />
            </Field>

            <Field
              label="Близость своего магазина"
              hint="Есть ли другая точка сети в той же зоне доступности"
              source="Адреса своих магазинов и маршрут на карте"
              className="sm:col-span-2"
            >
              <Controller
                control={control}
                name="ownStoreNearby"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Нет</SelectItem>
                      <SelectItem value="yes">Да</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Комментарий"
              htmlFor="comment"
              error={errors.comment?.message}
              className="sm:col-span-2"
            >
              <Textarea
                id="comment"
                rows={3}
                placeholder="Что ещё важно учесть по району…"
                {...register("comment")}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Живая оценка */}
      <div className="space-y-4">
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Оценка потенциала</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p
                className={cn(
                  "text-5xl font-bold tabular-nums",
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
              <p className="mt-2 text-sm font-medium">{verdict.verdict}</p>
            </div>

            <Separator />

            <div className="space-y-2.5">
              {(Object.keys(scores) as (keyof DistrictScores)[]).map((key) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {DISTRICT_CRITERIA_LABELS[key]}
                    </span>
                    <span className="font-medium tabular-nums">{scores[key]}</span>
                  </div>
                  <Progress value={scores[key]} className="h-1.5" />
                </div>
              ))}
            </div>

            {missing.length > 0 && (
              <>
                <Separator />
                <p className="text-muted-foreground text-xs">
                  Не указано: {missing.join(", ").toLowerCase()} — балл по этим критериям усреднён.
                </p>
              </>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Сохранить анализ
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
