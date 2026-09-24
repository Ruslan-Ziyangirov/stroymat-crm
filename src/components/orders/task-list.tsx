"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NextStepDialog, type NextStepOrder } from "@/components/orders/next-step-dialog";
import { DEAL_TASK_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealTask, Profile } from "@/lib/types";

export function TaskList({
  order,
  tasks,
  managers,
  canClose,
}: {
  order: NextStepOrder;
  tasks: DealTask[];
  managers: Pick<Profile, "id" | "full_name">[];
  canClose: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const now = React.useMemo(() => new Date(), []);
  const openTask = tasks.find((t) => t.status === "open") ?? null;
  const history = tasks.filter((t) => t.status !== "open");
  const overdue = openTask ? new Date(openTask.due_at).getTime() < now.getTime() : false;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Задачи</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          Следующий шаг
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {openTask ? (
          <div
            className={cn(
              "rounded-xl p-3 text-sm",
              overdue ? "bg-red-50 text-red-800" : "bg-muted/60",
            )}
          >
            <p className="flex items-center gap-1.5 font-medium">
              {overdue && <AlertTriangle className="size-4 shrink-0" />}
              {formatDateTime(openTask.due_at)} — {DEAL_TASK_TYPE_LABELS[openTask.type]}
            </p>
            <p className="mt-1">{openTask.comment}</p>
            {openTask.assignee?.full_name && (
              <p className="text-muted-foreground mt-1 text-xs">
                Ответственный: {openTask.assignee.full_name}
              </p>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
            <AlertTriangle className="size-4 shrink-0" />
            Нет открытой задачи — по методологии у активной сделки всегда должен быть следующий шаг.
          </p>
        )}

        {history.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              История
            </p>
            <ul className="space-y-2">
              {history.map((task) => (
                <li key={task.id} className="text-muted-foreground flex items-start gap-2 text-xs">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {formatDateTime(task.due_at)} — {DEAL_TASK_TYPE_LABELS[task.type]}: {task.comment}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <NextStepDialog
        open={open}
        onOpenChange={setOpen}
        order={order}
        managers={managers}
        canClose={canClose}
      />
    </Card>
  );
}
