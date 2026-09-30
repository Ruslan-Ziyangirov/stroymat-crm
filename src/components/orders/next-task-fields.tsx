"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { DEAL_TASK_TYPE_LABELS } from "@/lib/constants";
import { toDatetimeLocalValue, tomorrowAt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealTaskType, Profile } from "@/lib/types";

const NONE = "__none__";

export interface TaskDraft {
  assignee_id: string;
  type: DealTaskType;
  due_at: string;
  comment: string;
}

export type TaskDraftErrors = Partial<Record<keyof TaskDraft, string>>;

export function emptyTaskDraft(assigneeId: string | null | undefined): TaskDraft {
  return {
    assignee_id: assigneeId ?? "",
    type: "call",
    due_at: toDatetimeLocalValue(tomorrowAt(10)),
    comment: "",
  };
}

/** Те же правила, что и в dealTaskSchema на сервере — чтобы подсветить поля до отправки. */
export function validateTaskDraft(draft: TaskDraft): TaskDraftErrors {
  const errors: TaskDraftErrors = {};
  if (!draft.due_at) errors.due_at = "Укажите дедлайн";
  if (draft.comment.trim().length < 3) errors.comment = "Опишите, что конкретно нужно сделать";
  return errors;
}

function at(date: Date, hour: number, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function quickPicks(): { label: string; date: Date }[] {
  const now = new Date();
  const picks: { label: string; date: Date }[] = [
    { label: "Через 2 часа", date: new Date(now.getTime() + 2 * 3_600_000) },
  ];
  if (now.getHours() < 16) picks.push({ label: "Сегодня 17:00", date: at(now, 17) });
  picks.push({ label: "Завтра 10:00", date: tomorrowAt(10) });
  picks.push({ label: "Через 3 дня", date: at(addDays(3), 10) });
  const toMonday = ((8 - now.getDay()) % 7) || 7;
  picks.push({ label: "В понедельник", date: at(addDays(toMonday), 10) });
  return picks;
}

export function NextTaskFields({
  value,
  onChange,
  managers,
  errors = {},
  title = "Следующая задача (обязательно)",
}: {
  value: TaskDraft;
  onChange: (next: TaskDraft) => void;
  managers: Pick<Profile, "id" | "full_name">[];
  errors?: TaskDraftErrors;
  title?: string;
}) {
  const set = <K extends keyof TaskDraft>(key: K, v: TaskDraft[K]) => onChange({ ...value, [key]: v });
  const picks = React.useMemo(() => quickPicks(), []);

  return (
    <div className="grid gap-4 rounded-xl border p-3 sm:grid-cols-2">
      <p className="text-muted-foreground text-xs sm:col-span-2">{title}</p>
      <Field label="Ответственный">
        <Select
          value={value.assignee_id || NONE}
          onValueChange={(v) => set("assignee_id", v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Ответственный по сделке" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Ответственный по сделке</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Тип действия">
        <Select value={value.type} onValueChange={(v) => set("type", v as DealTaskType)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DEAL_TASK_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Точный дедлайн" error={errors.due_at} className="sm:col-span-2">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {picks.map((pick) => {
              const pickValue = toDatetimeLocalValue(pick.date);
              return (
                <button
                  key={pick.label}
                  type="button"
                  onClick={() => set("due_at", pickValue)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    value.due_at === pickValue
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  {pick.label}
                </button>
              );
            })}
          </div>
          <Input
            type="datetime-local"
            value={value.due_at}
            onChange={(e) => set("due_at", e.target.value)}
            aria-invalid={!!errors.due_at}
          />
        </div>
      </Field>
      <Field
        label="Что сделать"
        error={errors.comment}
        hint="Конкретно: «Позвонить, уточнить объём кирпича и сроки»"
        className="sm:col-span-2"
      >
        <Textarea
          rows={2}
          value={value.comment}
          onChange={(e) => set("comment", e.target.value)}
          aria-invalid={!!errors.comment}
        />
      </Field>
    </div>
  );
}
