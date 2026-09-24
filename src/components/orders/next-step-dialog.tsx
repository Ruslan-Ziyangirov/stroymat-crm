"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { moveOrderStage } from "@/lib/actions/pipeline";
import {
  DEAL_PRIORITY_LABELS,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_ORDER,
  DEAL_TASK_TYPE_LABELS,
  DEAL_TYPE_LABELS,
  DEAL_URGENCY_LABELS,
  REJECTION_REASONS,
} from "@/lib/constants";
import { formatDateTime, formatMoney, toDatetimeLocalValue, tomorrowAt } from "@/lib/format";
import type { DealPriority, DealStage, DealTaskType, DealType, DealUrgency, Profile } from "@/lib/types";

const NONE = "__none__";

export interface NextStepOrder {
  id: string;
  number: string;
  name: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  total: number;
  comment: string | null;
  created_at: string;
  stage: DealStage;
  manager_id: string | null;
  manager_name: string | null;
  budget: number | null;
  priority: DealPriority | null;
  product_interest: string | null;
  urgency: DealUrgency | null;
  deal_type: DealType | null;
  proposal_amount: number | null;
  rejection_reason: string | null;
  rejection_comment: string | null;
  openTask: { due_at: string; type: DealTaskType; comment: string } | null;
}

interface FormValues {
  targetStage: DealStage;
  budget: string;
  priority: DealPriority | "";
  product_interest: string;
  urgency: DealUrgency | "";
  deal_type: DealType | "";
  proposal_amount: string;
  meeting_at: string;
  rejection_reason: string;
  rejection_comment: string;
  assignee_id: string;
  task_type: DealTaskType;
  due_at: string;
  comment: string;
}

export function NextStepDialog({
  open,
  onOpenChange,
  order,
  initialTargetStage,
  managers,
  canClose,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: NextStepOrder;
  initialTargetStage?: DealStage;
  managers: Pick<Profile, "id" | "full_name">[];
  canClose: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      targetStage: initialTargetStage ?? order.stage,
      budget: order.budget != null ? String(order.budget) : "",
      priority: order.priority ?? "",
      product_interest: order.product_interest ?? "",
      urgency: order.urgency ?? "",
      deal_type: order.deal_type ?? "",
      proposal_amount: order.proposal_amount != null ? String(order.proposal_amount) : "",
      meeting_at: "",
      rejection_reason: "",
      rejection_comment: "",
      assignee_id: order.manager_id ?? "",
      task_type: "call",
      due_at: toDatetimeLocalValue(tomorrowAt(10)),
      comment: "",
    },
  });

  // При каждом открытии диалога — пересобрать дефолты под актуальный заказ/цель.
  React.useEffect(() => {
    if (open) {
      reset({
        targetStage: initialTargetStage ?? order.stage,
        budget: order.budget != null ? String(order.budget) : "",
        priority: order.priority ?? "",
        product_interest: order.product_interest ?? "",
        urgency: order.urgency ?? "",
        deal_type: order.deal_type ?? "",
        proposal_amount: order.proposal_amount != null ? String(order.proposal_amount) : "",
        meeting_at: "",
        rejection_reason: "",
        rejection_comment: "",
        assignee_id: order.manager_id ?? "",
        task_type: "call",
        due_at: toDatetimeLocalValue(tomorrowAt(10)),
        comment: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id, initialTargetStage]);

  const targetStage = useWatch({ control, name: "targetStage" });
  const needsProposalFields = targetStage === "proposal_sent";
  const needsMeeting = targetStage === "meeting_scheduled";
  const needsRejection = targetStage === "conditional_rejection";
  const needsTask = !["won", "closed_lost", "conditional_rejection"].includes(targetStage);

  const stageOptions = DEAL_STAGE_ORDER.filter((s) => s !== "closed_lost" || canClose);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = await moveOrderStage(order.id, {
        targetStage: values.targetStage,
        fields: {
          budget: values.budget || undefined,
          priority: values.priority || undefined,
          product_interest: values.product_interest || undefined,
          urgency: values.urgency || undefined,
          deal_type: values.deal_type || undefined,
          proposal_amount: values.proposal_amount || undefined,
          meeting_at: values.meeting_at || undefined,
          rejection_reason: values.rejection_reason || undefined,
          rejection_comment: values.rejection_comment || undefined,
        },
        task: needsTask
          ? {
              assignee_id: values.assignee_id || undefined,
              type: values.task_type,
              due_at: values.due_at,
              comment: values.comment,
            }
          : undefined,
      });

      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить");
        return;
      }
      toast.success("Сохранено");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{order.name}</DialogTitle>
          <DialogDescription>
            Текущий этап: {DEAL_STAGE_LABELS[order.stage]}. Ниже — данные заказа и следующий шаг.
          </DialogDescription>
        </DialogHeader>

        <OrderInfoPanel order={order} />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm font-medium">Следующий шаг</p>
          <Field label="Этап сделки">
            <Controller
              control={control}
              name="targetStage"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {DEAL_STAGE_LABELS[stage]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {needsProposalFields && (
            <div className="grid gap-4 rounded-xl border border-dashed p-3 sm:grid-cols-2">
              <p className="text-muted-foreground text-xs sm:col-span-2">
                Обязательно для «КП отправлено»
              </p>
              <Field label="Бюджет, ₽" htmlFor="budget">
                <Input id="budget" type="number" min="0" step="1" {...register("budget")} />
              </Field>
              <Field label="Сумма КП, ₽" htmlFor="proposal_amount">
                <Input id="proposal_amount" type="number" min="0" step="1" {...register("proposal_amount")} />
              </Field>
              <Field label="Приоритет">
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Не выбран" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Не выбран</SelectItem>
                        {Object.entries(DEAL_PRIORITY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Тип сделки">
                <Controller
                  control={control}
                  name="deal_type"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Не выбран" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Не выбран</SelectItem>
                        {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Интересующий товар" htmlFor="product_interest" className="sm:col-span-2">
                <Input id="product_interest" placeholder="Цемент, кирпич…" {...register("product_interest")} />
              </Field>
              <Field label="Срочность">
                <Controller
                  control={control}
                  name="urgency"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Не указана" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Не указана</SelectItem>
                        {Object.entries(DEAL_URGENCY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          )}

          {needsMeeting && (
            <Field label="Дата и время встречи" htmlFor="meeting_at" hint="Обязательно для «Встреча назначена»">
              <Input id="meeting_at" type="datetime-local" {...register("meeting_at")} />
            </Field>
          )}

          {needsRejection && (
            <div className="space-y-4 rounded-xl border border-dashed p-3">
              <Field label="Причина отказа">
                <Controller
                  control={control}
                  name="rejection_reason"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите причину" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Выберите причину</SelectItem>
                        {REJECTION_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                label="Что произошло"
                htmlFor="rejection_comment"
                hint="Окончательно закрыть сделку как нереализованную сможет только руководитель"
              >
                <Textarea id="rejection_comment" rows={3} {...register("rejection_comment")} />
              </Field>
            </div>
          )}

          {needsTask && (
            <div className="grid gap-4 rounded-xl border p-3 sm:grid-cols-2">
              <p className="text-muted-foreground text-xs sm:col-span-2">Следующая задача (обязательно)</p>
              <Field label="Ответственный">
                <Controller
                  control={control}
                  name="assignee_id"
                  render={({ field }) => (
                    <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Не назначен" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Не назначен</SelectItem>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Тип действия">
                <Controller
                  control={control}
                  name="task_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DEAL_TASK_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Точный дедлайн" htmlFor="due_at" className="sm:col-span-2">
                <Input id="due_at" type="datetime-local" {...register("due_at")} />
              </Field>
              <Field
                label="Комментарий"
                htmlFor="comment"
                hint="Что конкретно нужно сделать"
                className="sm:col-span-2"
              >
                <Textarea id="comment" rows={2} {...register("comment")} />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderInfoPanel({ order }: { order: NextStepOrder }) {
  const hasDealFields =
    order.budget != null ||
    order.proposal_amount != null ||
    order.priority ||
    order.deal_type ||
    order.product_interest ||
    order.urgency;

  return (
    <div className="bg-muted/30 space-y-2.5 rounded-xl border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          {order.client_id ? (
            <Link
              href={`/clients/${order.client_id}`}
              className="text-primary font-medium hover:underline"
            >
              {order.client_name}
            </Link>
          ) : (
            <p className="font-medium">{order.client_name}</p>
          )}
          {order.client_phone && (
            <p className="text-muted-foreground text-xs">{order.client_phone}</p>
          )}
        </div>
        <Link
          href={`/orders/${order.id}`}
          className="text-primary shrink-0 text-xs font-medium whitespace-nowrap hover:underline"
        >
          Открыть заказ →
        </Link>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>{order.number}</span>
        <span>от {formatDateTime(order.created_at)}</span>
        {order.manager_name && <span>{order.manager_name}</span>}
        {order.total > 0 && (
          <span className="text-foreground font-medium">{formatMoney(order.total)}</span>
        )}
      </div>

      {hasDealFields && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs">
          {order.budget != null && <InfoRow label="Бюджет" value={formatMoney(order.budget)} />}
          {order.proposal_amount != null && (
            <InfoRow label="Сумма КП" value={formatMoney(order.proposal_amount)} />
          )}
          {order.priority && (
            <InfoRow label="Приоритет" value={DEAL_PRIORITY_LABELS[order.priority]} />
          )}
          {order.deal_type && <InfoRow label="Тип сделки" value={DEAL_TYPE_LABELS[order.deal_type]} />}
          {order.product_interest && <InfoRow label="Товар" value={order.product_interest} />}
          {order.urgency && <InfoRow label="Срочность" value={DEAL_URGENCY_LABELS[order.urgency]} />}
        </div>
      )}

      {order.comment && (
        <p className="text-muted-foreground border-t pt-2 text-xs">{order.comment}</p>
      )}

      {order.rejection_reason && (
        <p className="border-t pt-2 text-xs text-red-700">
          Условный отказ: {order.rejection_reason}
          {order.rejection_comment ? ` — ${order.rejection_comment}` : ""}
        </p>
      )}

      {order.openTask && (
        <div className="flex items-start gap-1.5 border-t pt-2 text-xs">
          <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Текущая задача: {formatDateTime(order.openTask.due_at)} —{" "}
            {DEAL_TASK_TYPE_LABELS[order.openTask.type]}
            {order.openTask.comment ? `. ${order.openTask.comment}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
