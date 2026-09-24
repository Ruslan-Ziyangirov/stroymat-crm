import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock,
  Gift,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DealStageBadge } from "@/components/common/badges";
import { AddEventForm } from "@/components/clients/add-event-form";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { CLIENT_TYPE_LABELS, EVENT_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Client, ClientEvent, Order } from "@/lib/types";

export const metadata: Metadata = { title: "Карточка клиента" };

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [clientRes, ordersRes, eventsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*, manager:profiles!clients_manager_id_fkey(id, full_name), store:stores(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, number, stage, total, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_events")
      .select("*, author:profiles(id, full_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!clientRes.data) notFound();

  const client = clientRes.data as unknown as Client;
  const orders = (ordersRes.data ?? []) as unknown as Order[];
  const events = (eventsRes.data ?? []) as unknown as ClientEvent[];

  const realOrders = orders.filter((o) => o.stage !== "closed_lost");
  const totalSum = realOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const lastOrder = orders[0];

  return (
    <>
      <PageHeader
        title={client.name}
        description={`${CLIENT_TYPE_LABELS[client.type]}${client.inn ? ` · ИНН ${client.inn}` : ""} · в базе с ${formatDate(client.created_at)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/clients/${client.id}/edit`}>
                <Pencil className="size-4" />
                Редактировать
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/orders/new?client=${client.id}`}>
                <Plus className="size-4" />
                Новый заказ
              </Link>
            </Button>
            <DeleteClientButton id={client.id} name={client.name} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Реквизиты */}
        <Card>
          <CardHeader>
            <CardTitle>Реквизиты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={<Phone className="size-4" />} value={client.phone} />
            <InfoRow icon={<Mail className="size-4" />} value={client.email} />
            <InfoRow icon={<MapPin className="size-4" />} value={client.address} />
            <Separator />
            <Row label="Ответственный" value={client.manager?.full_name ?? "Не назначен"} />
            <Row label="Магазин" value={client.store?.name ?? "—"} />
            <Row label="Источник" value={client.source ?? "—"} />
            <Row label="Скидка" value={`${client.discount_percent} %`} />
            {client.note && (
              <>
                <Separator />
                <p className="text-muted-foreground">{client.note}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Показатели */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Показатели работы</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <Metric
              icon={<ReceiptText className="size-4" />}
              label="Заказов"
              value={String(realOrders.length)}
            />
            <Metric
              icon={<ReceiptText className="size-4" />}
              label="Сумма заказов"
              value={formatMoney(totalSum)}
            />
            <Metric
              icon={<Gift className="size-4" />}
              label="Бонусный баланс"
              value={formatMoney(client.bonus_balance)}
            />
            <Metric
              icon={<CalendarClock className="size-4" />}
              label="Последний заказ"
              value={lastOrder ? formatDate(lastOrder.created_at) : "—"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Заказы */}
        <Card>
          <CardHeader>
            <CardTitle>Заказы клиента</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {orders.length ? (
                orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="hover:bg-muted/50 flex items-center gap-3 px-6 py-3 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{order.number}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <DealStageBadge stage={order.stage} />
                      <span className="w-28 text-right text-sm font-semibold tabular-nums">
                        {formatMoney(order.total)}
                      </span>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground px-6 py-10 text-center text-sm">
                  Заказов ещё не было
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* История */}
        <Card>
          <CardHeader>
            <CardTitle>История работы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <AddEventForm clientId={client.id} />
            <Separator />
            <ol className="space-y-4">
              {events.length ? (
                events.map((event) => (
                  <li key={event.id} className="relative pl-5">
                    <span className="bg-primary absolute top-1.5 left-0 size-2 rounded-full" />
                    <p className="text-sm font-medium">{event.title}</p>
                    {event.description && (
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {event.description}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {EVENT_TYPE_LABELS[event.type] ?? event.type} ·{" "}
                      {formatDateTime(event.created_at)}
                      {event.author?.full_name ? ` · ${event.author.full_name}` : ""}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground text-sm">Записей пока нет</li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-lg font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
