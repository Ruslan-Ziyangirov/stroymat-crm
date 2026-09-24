import Link from "next/link";
import { Building2, Phone, ReceiptText, UserRound } from "lucide-react";

import { CLIENT_TYPE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { ClientType } from "@/lib/types";

export interface ClientCardRow {
  id: string;
  name: string;
  type: ClientType;
  phone: string | null;
  manager_name: string | null;
  store_name: string | null;
  orders_count: number;
  orders_total: number;
}

/** Простой список карточек клиентов — без канбана, без таблицы. */
export function ClientCards({ data }: { data: ClientCardRow[] }) {
  if (!data.length) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
        Клиентов пока нет
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((client) => (
        <Link
          key={client.id}
          href={`/clients/${client.id}`}
          className="bg-card block rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <p className="truncate font-medium">{client.name}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{CLIENT_TYPE_LABELS[client.type]}</p>

          <div className="mt-3 space-y-1.5 text-sm">
            {client.phone && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                {client.phone}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <UserRound className="size-3.5 shrink-0" />
              {client.manager_name ?? "Не назначен"}
            </p>
            {client.store_name && (
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" />
                {client.store_name}
              </p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-sm font-medium">
            <ReceiptText className="text-muted-foreground size-3.5 shrink-0" />
            {client.orders_count} заказ(ов) на {formatMoney(client.orders_total)}
          </div>
        </Link>
      ))}
    </div>
  );
}
