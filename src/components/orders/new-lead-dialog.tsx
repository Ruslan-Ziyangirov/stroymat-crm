"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Zap } from "lucide-react";
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import {
  QuickAddClientDialog,
  type QuickClient,
} from "@/components/clients/quick-add-client-dialog";
import {
  NextTaskFields,
  emptyTaskDraft,
  validateTaskDraft,
  type TaskDraft,
} from "@/components/orders/next-task-fields";
import { createLead } from "@/lib/actions/orders";
import type { Profile } from "@/lib/types";

const NEW_CLIENT = "__new_client__";
const ME = "__me__";

interface LeadDraft {
  client_id: string;
  manager_id: string;
  product_interest: string;
  comment: string;
}

const emptyLead = (): LeadDraft => ({ client_id: "", manager_id: "", product_interest: "", comment: "" });

function validateLead(lead: LeadDraft) {
  const errors: Partial<Record<keyof LeadDraft, string>> = {};
  if (!lead.client_id) errors.client_id = "Выберите клиента";
  if (lead.product_interest.trim().length < 2) errors.product_interest = "Опишите, что интересует клиента";
  return errors;
}

export function NewLeadDialog({
  clients,
  managers,
}: {
  clients: { id: string; name: string }[];
  managers: Pick<Profile, "id" | "full_name">[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [clientList, setClientList] = React.useState(clients);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [lead, setLead] = React.useState<LeadDraft>(emptyLead);
  const [task, setTask] = React.useState<TaskDraft>(() => emptyTaskDraft(null));
  const [submitted, setSubmitted] = React.useState(false);

  const leadErrors = submitted ? validateLead(lead) : {};
  const taskErrors = submitted ? validateTaskDraft(task) : {};

  const openDialog = () => {
    setLead(emptyLead());
    setTask(emptyTaskDraft(null));
    setSubmitted(false);
    setOpen(true);
  };

  const set = <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) =>
    setLead((prev) => ({ ...prev, [key]: value }));

  const handleClientCreated = (client: QuickClient) => {
    setClientList((prev) => [client, ...prev]);
    set("client_id", client.id);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateLead(lead)).length || Object.keys(validateTaskDraft(task)).length) return;

    startTransition(async () => {
      const result = await createLead(
        {
          client_id: lead.client_id,
          manager_id: lead.manager_id || undefined,
          product_interest: lead.product_interest,
          comment: lead.comment,
        },
        {
          assignee_id: task.assignee_id || undefined,
          type: task.type,
          due_at: task.due_at,
          comment: task.comment,
        },
      );
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось создать лид");
        return;
      }
      toast.success("Лид добавлен в воронку");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <Zap className="size-4" />
        Новый лид
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый лид</DialogTitle>
            <DialogDescription>
              Быстро завести обращение без состава заказа. Позиции добавите, когда дойдёт до КП.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Клиент" error={leadErrors.client_id}>
              <Select
                value={lead.client_id || undefined}
                onValueChange={(value) => {
                  if (value === NEW_CLIENT) {
                    setQuickAddOpen(true);
                    return;
                  }
                  set("client_id", value);
                }}
              >
                <SelectTrigger className="w-full" aria-invalid={!!leadErrors.client_id}>
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_CLIENT} className="text-primary font-medium">
                    <UserPlus className="size-3.5" />
                    Добавить нового клиента
                  </SelectItem>
                  <SelectSeparator />
                  {clientList.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Что интересует" error={leadErrors.product_interest}>
              <Input
                value={lead.product_interest}
                onChange={(e) => set("product_interest", e.target.value)}
                placeholder="Кирпич облицовочный, ~2 000 шт., под дом"
                aria-invalid={!!leadErrors.product_interest}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ответственный менеджер">
                <Select
                  value={lead.manager_id || ME}
                  onValueChange={(v) => set("manager_id", v === ME ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ME}>Назначить меня</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Комментарий">
                <Textarea
                  rows={1}
                  value={lead.comment}
                  onChange={(e) => set("comment", e.target.value)}
                  placeholder="Откуда пришёл, детали"
                />
              </Field>
            </div>

            <NextTaskFields
              value={task}
              onChange={setTask}
              managers={managers}
              errors={taskErrors}
              title="Первая задача (обязательно)"
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Создать лид
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <QuickAddClientDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={handleClientCreated}
      />
    </>
  );
}
