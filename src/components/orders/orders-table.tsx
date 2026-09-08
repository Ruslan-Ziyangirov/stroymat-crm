"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type CrmColumnDef } from "@/components/common/data-table";
import { OrderStatusBadge } from "@/components/common/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export interface OrderRow extends Record<string, unknown> {
  id: string;
  number: string;
  client: string;
  manager: string;
  store: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  items_count: number;
}

const ALL = "__all__";

const columns: CrmColumnDef<OrderRow>[] = [
  {
    accessorKey: "number",
    header: "Заказ",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.number}</p>
        <p className="text-muted-foreground text-xs">
          {formatDate(row.original.created_at)} · позиций: {row.original.items_count}
        </p>
      </div>
    ),
  },
  { accessorKey: "client", header: "Клиент" },
  {
    accessorKey: "status",
    header: "Статус",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
  },
  { accessorKey: "manager", header: "Менеджер" },
  { accessorKey: "store", header: "Магазин" },
  {
    accessorKey: "total",
    header: "Сумма",
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">{formatMoney(row.original.total)}</span>
    ),
  },
];

export function OrdersTable({ data }: { data: OrderRow[] }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<string>(ALL);

  const filtered = React.useMemo(
    () => (status === ALL ? data : data.filter((row) => row.status === status)),
    [data, status],
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      searchKeys={["number", "client", "manager", "store"]}
      searchPlaceholder="Поиск по номеру, клиенту, менеджеру…"
      emptyMessage="Заказы не найдены"
      onRowClick={(row) => router.push(`/orders/${row.id}`)}
      toolbar={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все статусы</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
