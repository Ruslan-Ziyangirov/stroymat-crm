import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DeleteOrderButton } from "@/components/orders/delete-order-button";
import { TaskList } from "@/components/orders/task-list";
import { DealStageBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, isPrivileged } from "@/lib/auth";
import { getManagers } from "@/lib/queries/refs";
import { EVENT_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { ClientEvent, DealTask, Order } from "@/lib/types";

export const metadata: Metadata = { title: "Заказ" };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [orderRes, eventsRes, tasksRes, managers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, client:clients(id, name, phone, bonus_balance), manager:profiles!orders_manager_id_fkey(id, full_name), store:stores(id, name), items:order_items(*)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("client_events")
      .select("*, author:profiles(id, full_name)")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deal_tasks")
      .select("*, assignee:profiles!deal_tasks_assignee_id_fkey(id, full_name)")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    getManagers(),
  ]);

  if (!orderRes.data) notFound();

  const order = orderRes.data as unknown as Order;
  const items = (order.items ?? []).sort((a, b) => a.position - b.position);
  const events = (eventsRes.data ?? []) as unknown as ClientEvent[];
  const tasks = (tasksRes.data ?? []) as unknown as DealTask[];
  const openTask = tasks.find((t) => t.status === "open") ?? null;

  return (
    <>
      <PageHeader
        title={`Заказ ${order.number}`}
        description={`Создан ${formatDateTime(order.created_at)}${order.store?.name ? ` · ${order.store.name}` : ""}`}
        actions={
          <>
            <DealStageBadge stage={order.stage} />
            <Button asChild variant="outline">
              <Link href={`/orders/${order.id}/edit`}>
                <Pencil className="size-4" />
                Редактировать
              </Link>
            </Button>
            <DeleteOrderButton id={order.id} number={order.number} />
          </>
        }
      />

      <div className="mb-4">
        <TaskList
          order={{
            id: order.id,
            number: order.number,
            name: `${order.client?.name ?? "Клиент удалён"} · ${order.number}`,
            client_id: order.client?.id ?? null,
            client_name: order.client?.name ?? "Клиент удалён",
            client_phone: order.client?.phone ?? null,
            total: order.total,
            comment: order.comment,
            created_at: order.created_at,
            stage: order.stage,
            manager_id: order.manager_id,
            manager_name: order.manager?.full_name ?? null,
            budget: order.budget,
            priority: order.priority,
            product_interest: order.product_interest,
            urgency: order.urgency,
            deal_type: order.deal_type,
            proposal_amount: order.proposal_amount,
            rejection_reason: order.rejection_reason,
            rejection_comment: order.rejection_comment,
            openTask: openTask
              ? { due_at: openTask.due_at, type: openTask.type, comment: openTask.comment }
              : null,
          }}
          tasks={tasks}
          managers={managers}
          canClose={isPrivileged(profile) && order.stage === "conditional_rejection"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Состав заказа</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">№</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.quantity, 3)} {item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.price, 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(item.amount, 2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Клиент</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.client ? (
                <Link
                  href={`/clients/${order.client.id}`}
                  className="text-primary font-medium hover:underline"
                >
                  {order.client.name}
                </Link>
              ) : (
                <p className="text-muted-foreground">Клиент удалён</p>
              )}
              {order.client?.phone && (
                <p className="text-muted-foreground">{order.client.phone}</p>
              )}
              <Separator />
              <Row label="Менеджер" value={order.manager?.full_name ?? "Не назначен"} />
              <Row label="Магазин" value={order.store?.name ?? "—"} />
              <Row label="Доставка" value={formatDate(order.delivery_date)} />
              {order.delivery_address && (
                <p className="text-muted-foreground">{order.delivery_address}</p>
              )}
              {order.comment && (
                <>
                  <Separator />
                  <p className="text-muted-foreground">{order.comment}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Итоги</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Позиции" value={formatMoney(order.items_total, 2)} />
              <Row label={`Скидка ${order.discount_percent} %`} value={`− ${formatMoney((order.items_total * order.discount_percent) / 100, 2)}`} />
              <Row label="Списано бонусов" value={`− ${formatMoney(order.bonus_used, 2)}`} />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">К оплате</span>
                <span className="text-primary text-xl font-bold tabular-nums">
                  {formatMoney(order.total, 2)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Бонусов к начислению: {formatMoney(order.bonus_earned, 2)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {events.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>История заказа</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="relative pl-5">
                  <span className="bg-primary absolute top-1.5 left-0 size-2 rounded-full" />
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.description && (
                    <p className="text-muted-foreground text-sm">{event.description}</p>
                  )}
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {EVENT_TYPE_LABELS[event.type] ?? event.type} ·{" "}
                    {formatDateTime(event.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
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
