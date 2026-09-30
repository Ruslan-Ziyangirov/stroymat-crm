"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Clock } from "lucide-react";

import { DealStageBadge } from "@/components/common/badges";
import { NextStepDialog, type NextStepOrder } from "@/components/orders/next-step-dialog";
import { WORK_BUCKET_ORDER, type WorkBucket, type WorkItem } from "@/lib/analytics/manager";
import { DEAL_TASK_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ROW_LIMIT = 12;

const BUCKETS: Record<WorkBucket, { title: string; className: string }> = {
  overdue: { title: "Просрочено", className: "text-red-700" },
  noTask: { title: "Без следующего шага", className: "text-red-700" },
  today: { title: "Сегодня", className: "text-amber-700" },
  tomorrow: { title: "Завтра", className: "text-foreground" },
  later: { title: "Позже", className: "text-muted-foreground" },
};

const moscowTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  });

const moscowDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
  });

export function WorkList({
  items,
  orders,
}: {
  items: WorkItem[];
  /** Данные сделок для окна «Следующий шаг», по id заказа. */
  orders: Record<string, NextStepOrder>;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const openOrder = openId ? orders[openId] : null;

  if (!items.length) {
    return (
      <p className="text-muted-foreground px-6 py-10 text-center text-sm">
        Активных сделок нет. Заведите лид или заказ на странице{" "}
        <Link href="/orders" className="text-primary hover:underline">
          «Заказы»
        </Link>
        .
      </p>
    );
  }

  const visible = items.slice(0, ROW_LIMIT);

  return (
    <>
      <div className="divide-y">
        {WORK_BUCKET_ORDER.map((bucket) => {
          const rows = visible.filter((item) => item.bucket === bucket);
          if (!rows.length) return null;
          const total = items.filter((item) => item.bucket === bucket).length;
          return (
            <section key={bucket}>
              <p
                className={cn(
                  "bg-muted/40 px-6 py-1.5 text-xs font-semibold tracking-wide uppercase",
                  BUCKETS[bucket].className,
                )}
              >
                {BUCKETS[bucket].title} · {total}
              </p>
              <ul className="divide-y">
                {rows.map((item) => (
                  <li key={item.orderId}>
                    <button
                      type="button"
                      onClick={() => setOpenId(item.orderId)}
                      className="hover:bg-muted/50 flex w-full items-center gap-3 px-6 py-3 text-left transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.clientName}{" "}
                          <span className="text-muted-foreground font-normal">· {item.orderNumber}</span>
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.task ? (
                            <>
                              {DEAL_TASK_TYPE_LABELS[item.task.type]} — {item.task.comment}
                            </>
                          ) : (
                            "Нет следующего шага — откройте и выберите этап"
                          )}
                        </p>
                        {item.stuckDays !== null && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                            <Clock className="size-3" />
                            Без движения {item.stuckDays} дн.
                          </p>
                        )}
                      </div>
                      <DealStageBadge stage={item.stage} />
                      {item.task && (
                        <span
                          className={cn(
                            "flex w-24 shrink-0 items-center justify-end gap-1 text-xs tabular-nums",
                            bucket === "overdue" ? "font-medium text-red-700" : "text-muted-foreground",
                          )}
                        >
                          <CalendarClock className="size-3.5" />
                          {bucket === "today" || bucket === "tomorrow"
                            ? moscowTime(item.task.due_at)
                            : `${moscowDate(item.task.due_at)} ${moscowTime(item.task.due_at)}`}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {items.length > ROW_LIMIT && (
        <p className="text-muted-foreground border-t px-6 py-3 text-sm">
          И ещё {items.length - ROW_LIMIT} — в{" "}
          <Link href="/orders" className="text-primary hover:underline">
            воронке заказов
          </Link>
          .
        </p>
      )}

      {openOrder && (
        <NextStepDialog
          open
          onOpenChange={(open) => !open && setOpenId(null)}
          order={openOrder}
          managers={[]}
          canClose={false}
          onDone={() => setOpenId(null)}
        />
      )}
    </>
  );
}
