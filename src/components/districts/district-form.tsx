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

type ScaleName =
  | "competitorStrength"
  | "priceLevel"
  | "infrastructure"
  | "demand"
  | "prospects"
  | "logistics";

const SCALE_LABELS: Record<ScaleName, string[]> = {
  competitorStrength: [
    "Мелкие точки",
    "Слабые локальные",
    "Средние игроки",
    "Сильные сети",
    "Федеральные гипермаркеты",
  ],
  priceLevel: ["Очень низкий", "Низкий", "Средний", "Выше среднего", "Премиум"],
  infrastructure: ["Почти нет", "Слабая", "Средняя", "Хорошая", "Отличная"],
  demand: ["Очень низкий", "Низкий", "Средний", "Высокий", "Очень высокий"],
  prospects: ["Район стагнирует", "Слабые", "Умеренные", "Хорошие", "Активное развитие"],
  logistics: ["Очень сложная", "Сложная", "Средняя", "Удобная", "Отличная"],
};

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
      competitors: inputs?.competitors ?? 0,
      competitorStrength: inputs?.competitorStrength ?? 3,
      priceLevel: inputs?.priceLevel ?? 3,
      residentialUnits: inputs?.residentialUnits ?? 0,
      newConstructions: inputs?.newConstructions ?? 0,
      infrastructure: inputs?.infrastructure ?? 3,
      demand: inputs?.demand ?? 3,
      prospects: inputs?.prospects ?? 3,
      rentCost: inputs?.rentCost ?? 0,
      logistics: inputs?.logistics ?? 3,
      comment: inputs?.comment ?? undefined,
    },
  });

  const watched = useWatch({ control });

  // Живой пересчёт оценки прямо во время заполнения.
  const preview: DistrictInputs = {
    competitors: Number(watched.competitors ?? 0),
    competitorStrength: Number(watched.competitorStrength ?? 3),
    priceLevel: Number(watched.priceLevel ?? 3),
    residentialUnits: Number(watched.residentialUnits ?? 0),
    newConstructions: Number(watched.newConstructions ?? 0),
    infrastructure: Number(watched.infrastructure ?? 3),
    demand: Number(watched.demand ?? 3),
    prospects: Number(watched.prospects ?? 3),
    rentCost: Number(watched.rentCost ?? 0),
    logistics: Number(watched.logistics ?? 3),
  };
  const scores = scoreDistrict(preview);
  const total = totalScore(scores);
  const verdict = verdictFor(total);

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

  const scaleField = (name: ScaleName, label: string) => (
    <Field label={label} error={errors[name]?.message}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={String(field.value ?? 3)}
            onValueChange={(v) => field.onChange(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE_LABELS[name].map((text, index) => (
                <SelectItem key={index} value={String(index + 1)}>
                  {index + 1} — {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );

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
            <CardTitle>Конкуренты и цены</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Магазинов-конкурентов"
              htmlFor="competitors"
              error={errors.competitors?.message}
              hint="Сколько строительных магазинов уже работает в районе"
            >
              <Input id="competitors" type="number" min="0" {...register("competitors")} />
            </Field>
            {scaleField("competitorStrength", "Сила конкурентов")}
            {scaleField("priceLevel", "Примерный уровень цен в районе")}
            <Field
              label="Аренда помещения, ₽/мес."
              htmlFor="rentCost"
              error={errors.rentCost?.message}
            >
              <Input id="rentCost" type="number" min="0" step="1000" {...register("rentCost")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Застройка и спрос</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Жилая застройка, квартир"
              htmlFor="residentialUnits"
              error={errors.residentialUnits?.message}
              hint="Оценочное число квартир и домов в зоне охвата"
            >
              <Input
                id="residentialUnits"
                type="number"
                min="0"
                step="100"
                {...register("residentialUnits")}
              />
            </Field>
            <Field
              label="Активных строек рядом"
              htmlFor="newConstructions"
              error={errors.newConstructions?.message}
            >
              <Input
                id="newConstructions"
                type="number"
                min="0"
                {...register("newConstructions")}
              />
            </Field>
            {scaleField("infrastructure", "Инфраструктура")}
            {scaleField("demand", "Потенциальный спрос")}
            {scaleField("prospects", "Перспективы развития района")}
            {scaleField("logistics", "Логистика и подъезд")}
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

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {analysis ? "Сохранить анализ" : "Сохранить анализ"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
