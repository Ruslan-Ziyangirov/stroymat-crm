import Link from "next/link";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import type { OrderRow } from "@/components/orders/orders-table";

/** Канбан-доска заказов по статусам с суммой в каждом столбце. */
export function OrdersKanban({ data }: { data: OrderRow[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {ORDER_STATUSES.map((status) => {
        const items = data.filter((order) => order.status === status);
        const sum = items.reduce((total, order) => total + order.total, 0);

        return (
          <div key={status} className="w-72 shrink-0">
            <div className="bg-muted/60 mb-3 rounded-2xl border p-3">
              <p className="text-sm font-semibold">{ORDER_STATUS_LABELS[status]}</p>
              <p className="text-muted-foreground text-xs">
                {items.length} · {formatMoney(sum)}
              </p>
            </div>

            <div className="space-y-2">
              {items.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="bg-card hover:border-primary/40 block rounded-2xl border p-3 shadow-sm transition-colors"
                >
                  <p className="truncate text-sm font-medium">{order.client}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {order.number} · {formatDate(order.created_at)}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{order.manager}</p>
                  <p className="mt-2 text-sm font-semibold tabular-nums">
                    {formatMoney(order.total)}
                  </p>
                </Link>
              ))}
              {!items.length && (
                <p className="text-muted-foreground rounded-2xl border border-dashed p-4 text-center text-xs">
                  Пусто
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
