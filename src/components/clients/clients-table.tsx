"use client";

import { useRouter } from "next/navigation";
import { DataTable, type CrmColumnDef } from "@/components/common/data-table";
import { ClientStatusBadge } from "@/components/common/badges";
import { CLIENT_TYPE_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import type { Client } from "@/lib/types";

/** Плоская строка таблицы — так проще искать и сортировать. */
export interface ClientRow extends Record<string, unknown> {
  id: string;
  name: string;
  type: Client["type"];
  status: Client["status"];
  phone: string | null;
  email: string | null;
  manager: string;
  store: string;
  bonus_balance: number;
  orders_count: number;
  orders_total: number;
}

const columns: CrmColumnDef<ClientRow>[] = [
  {
    accessorKey: "name",
    header: "Клиент",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-muted-foreground text-xs">
          {CLIENT_TYPE_LABELS[row.original.type]}
          {row.original.phone ? ` · ${row.original.phone}` : ""}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Статус",
    cell: ({ row }) => <ClientStatusBadge status={row.original.status} />,
  },
  { accessorKey: "manager", header: "Менеджер" },
  { accessorKey: "store", header: "Магазин" },
  {
    accessorKey: "orders_count",
    header: "Заказов",
    cell: ({ row }) => <span className="tabular-nums">{row.original.orders_count}</span>,
  },
  {
    accessorKey: "orders_total",
    header: "Сумма заказов",
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatMoney(row.original.orders_total)}</span>
    ),
  },
  {
    accessorKey: "bonus_balance",
    header: "Бонусы",
    cell: ({ row }) => (
      <span className="tabular-nums">{formatMoney(row.original.bonus_balance)}</span>
    ),
  },
];

export function ClientsTable({ data }: { data: ClientRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKeys={["name", "phone", "email", "manager", "store"]}
      searchPlaceholder="Поиск по названию, телефону, менеджеру…"
      emptyMessage="Клиенты не найдены"
      onRowClick={(row) => router.push(`/clients/${row.id}`)}
    />
  );
}
