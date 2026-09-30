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
import { formatDateTime, formatMoney } from "@/lib/format";
import type {
  DealPriority,
  DealStage,
  DealTaskType,
  DealType,
  DealUrgency,
  Profile,
} from "@/lib/types";

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
  priority: DealPriority | "";
  product_interest: string;
  urgency: DealUrgency | "";
  deal_type: DealType | "";
  proposal_amount: string;
  meeting_at: string;
  rejection_reason: string;
  rejection_comment: string;
}

type StageErrors = Partial<
  Record<Exclude<keyof FormValues, "targetStage">, string>
>;

interface Errors {
  stage: StageErrors;
  general?: string;
}

/** Сумма заказа — разумное значение по умолчанию для суммы КП. */
const amountDefault = (value: number | null, total: number) =>
  value != null ? String(value) : total > 0 ? String(total) : "";

function defaultValues(
  order: NextStepOrder,
  targetStage: DealStage,
): FormValues {
  return {
    targetStage,
    priority: order.priority ?? "",
    product_interest: order.product_interest ?? "",
    urgency: order.urgency ?? "",
    deal_type: order.deal_type ?? "",
    proposal_amount: amountDefault(order.proposal_amount, order.total),
    meeting_at: "",
    rejection_reason: "",
    rejection_comment: "",
  };
}

function validate(
  values: FormValues,
  currentStage: DealStage,
  result: string,
): Errors {
  const stage: StageErrors = {};
  const stageChanged = values.targetStage !== currentStage;

  if (stageChanged && values.targetStage === "proposal_sent") {
    const required = "Обязательно для «КП отправлено»";
    if (!values.proposal_amount) stage.proposal_amount = required;
    if (!values.priority) stage.priority = required;
    if (!values.deal_type) stage.deal_type = required;
    if (!values.product_interest.trim()) stage.product_interest = required;
  }
  if (
    stageChanged &&
    values.targetStage === "meeting_scheduled" &&
    !values.meeting_at
  ) {
    stage.meeting_at = "Укажите дату и время встречи";
  }
  if (stageChanged && values.targetStage === "conditional_rejection") {
    if (!values.rejection_reason) stage.rejection_reason = "Выберите причину";
    if (values.rejection_comment.trim().length < 3)
      stage.rejection_comment = "Опишите, что произошло";
  }

  const errors: Errors = { stage };
  if (!stageChanged && !result.trim()) {
    errors.general = "Запишите, что произошло, или выберите другой этап.";
  }
  return errors;
}

const hasErrors = (e: Errors) => Object.keys(e.stage).length > 0 || !!e.general;

interface NextStepProps {
  onOpenChange: (open: boolean) => void;
  order: NextStepOrder;
  initialTargetStage?: DealStage;
  managers: Pick<Profile, "id" | "full_name">[];
  canClose: boolean;
  onDone?: () => void;
}

export function NextStepDialog({
  open,
  ...props
}: NextStepProps & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {/* Содержимое монтируется заново при каждом открытии — форма всегда с чистыми дефолтами. */}
        <NextStepBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function NextStepBody({
  onOpenChange,
  order,
  initialTargetStage,
  canClose,
  onDone,
}: NextStepProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const { register, control, handleSubmit } = useForm<FormValues>({
    defaultValues: defaultValues(order, initialTargetStage ?? order.stage),
  });

  const values = useWatch({ control }) as FormValues;
  const targetStage = values.targetStage ?? order.stage;
  const stageChanged = targetStage !== order.stage;
  const errors: Errors = submitted
    ? validate({ ...values, targetStage }, order.stage, result)
    : { stage: {} };

  const stageOptions = DEAL_STAGE_ORDER.filter(
    (s) => s !== "closed_lost" || canClose || s === order.stage,
  );

  const onSubmit = (formValues: FormValues) => {
    setSubmitted(true);
    if (hasErrors(validate(formValues, order.stage, result))) return;

    startTransition(async () => {
      const response = await moveOrderStage(order.id, {
        targetStage: formValues.targetStage,
        result: result.trim() || undefined,
        fields: {
          priority: formValues.priority || undefined,
          product_interest: formValues.product_interest || undefined,
          urgency: formValues.urgency || undefined,
          deal_type: formValues.deal_type || undefined,
          proposal_amount: formValues.proposal_amount || undefined,
          meeting_at: formValues.meeting_at || undefined,
          rejection_reason: formValues.rejection_reason || undefined,
          rejection_comment: formValues.rejection_comment || undefined,
        },
      });

      if (!response.ok) {
        toast.error(response.error ?? "Не удалось сохранить");
        return;
      }
      toast.success("Сохранено");
      onOpenChange(false);
      onDone?.();
      router.refresh();
    });
  };

  const selectWithNone = (
    name: "priority" | "deal_type" | "urgency" | "rejection_reason",
    placeholder: string,
    options: [string, string][],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          value={field.value || NONE}
          onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
        >
          <SelectTrigger className="w-full" aria-invalid={!!errors.stage[name]}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{placeholder}</SelectItem>
            {options.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{order.name}</DialogTitle>
        <DialogDescription>
          Текущий этап: {DEAL_STAGE_LABELS[order.stage]}. Запишите, что
          произошло, и при необходимости смените этап — задача на следующий шаг
          поставится автоматически.
        </DialogDescription>
      </DialogHeader>

      <OrderInfoPanel order={order} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field
          label="Что произошло"
          hint={
            order.openTask
              ? `Итог по задаче «${DEAL_TASK_TYPE_LABELS[order.openTask.type]}: ${order.openTask.comment}» — попадёт в историю сделки`
              : "Итог звонка или встречи, договорённости, возражения клиента — попадёт в историю сделки"
          }
          error={errors.general}
        >
          <Textarea
            rows={2}
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="Например: клиент сравнивает с конкурентом, просит скидку 5 %"
          />
        </Field>

        <Field label="Новый этап сделки">
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
                      {stage === order.stage ? " — без изменений" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {stageChanged && targetStage === "proposal_sent" && (
          <div className="grid gap-4 rounded-xl border border-dashed p-3 sm:grid-cols-2">
            <p className="text-muted-foreground text-xs sm:col-span-2">
              Обязательно для «КП отправлено». Сумма КП подставлена из суммы
              заказа.
            </p>
            <Field
              label="Сумма КП, ₽"
              htmlFor="proposal_amount"
              error={errors.stage.proposal_amount}
            >
              <Input
                id="proposal_amount"
                type="number"
                min="0"
                step="1"
                {...register("proposal_amount")}
              />
            </Field>
            <Field label="Приоритет" error={errors.stage.priority}>
              {selectWithNone(
                "priority",
                "Не выбран",
                Object.entries(DEAL_PRIORITY_LABELS),
              )}
            </Field>
            <Field label="Тип сделки" error={errors.stage.deal_type}>
              {selectWithNone(
                "deal_type",
                "Не выбран",
                Object.entries(DEAL_TYPE_LABELS),
              )}
            </Field>
            <Field
              label="Интересующий товар"
              htmlFor="product_interest"
              error={errors.stage.product_interest}
              className="sm:col-span-2"
            >
              <Input
                id="product_interest"
                placeholder="Цемент, кирпич…"
                {...register("product_interest")}
              />
            </Field>
            <Field label="Срочность">
              {selectWithNone(
                "urgency",
                "Не указана",
                Object.entries(DEAL_URGENCY_LABELS),
              )}
            </Field>
          </div>
        )}

        {stageChanged && targetStage === "meeting_scheduled" && (
          <Field
            label="Дата и время встречи"
            htmlFor="meeting_at"
            error={errors.stage.meeting_at}
          >
            <Input
              id="meeting_at"
              type="datetime-local"
              {...register("meeting_at")}
            />
          </Field>
        )}

        {stageChanged && targetStage === "conditional_rejection" && (
          <div className="space-y-4 rounded-xl border border-dashed p-3">
            <Field label="Причина отказа" error={errors.stage.rejection_reason}>
              {selectWithNone(
                "rejection_reason",
                "Выберите причину",
                REJECTION_REASONS.map((r) => [r, r]),
              )}
            </Field>
            <Field
              label="Что произошло"
              htmlFor="rejection_comment"
              error={errors.stage.rejection_comment}
              hint="Окончательно закрыть сделку как нереализованную сможет только руководитель"
            >
              <Textarea
                id="rejection_comment"
                rows={3}
                {...register("rejection_comment")}
              />
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </form>
    </>
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
            <p className="text-muted-foreground text-xs">
              {order.client_phone}
            </p>
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
        {order.total > 0 ? (
          <span className="text-foreground font-medium">
            {formatMoney(order.total)}
          </span>
        ) : (
          <span>позиции ещё не добавлены</span>
        )}
      </div>

      {hasDealFields && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs">
          {order.budget != null && (
            <InfoRow label="Бюджет" value={formatMoney(order.budget)} />
          )}
          {order.proposal_amount != null && (
            <InfoRow
              label="Сумма КП"
              value={formatMoney(order.proposal_amount)}
            />
          )}
          {order.priority && (
            <InfoRow
              label="Приоритет"
              value={DEAL_PRIORITY_LABELS[order.priority]}
            />
          )}
          {order.deal_type && (
            <InfoRow
              label="Тип сделки"
              value={DEAL_TYPE_LABELS[order.deal_type]}
            />
          )}
          {order.product_interest && (
            <InfoRow label="Интерес" value={order.product_interest} />
          )}
          {order.urgency && (
            <InfoRow
              label="Срочность"
              value={DEAL_URGENCY_LABELS[order.urgency]}
            />
          )}
        </div>
      )}

      {order.comment && (
        <p className="text-muted-foreground border-t pt-2 text-xs">
          {order.comment}
        </p>
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
