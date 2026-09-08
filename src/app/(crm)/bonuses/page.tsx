import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { BonusForm } from "@/components/clients/bonus-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { BONUS_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { BonusTransaction, Client } from "@/lib/types";

export const metadata: Metadata = { title: "Бонусная система" };

export default async function BonusesPage() {
  await requireProfile();
  const supabase = await createClient();

  const [clientsRes, txRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, bonus_balance")
      .order("bonus_balance", { ascending: false }),
    supabase
      .from("bonus_transactions")
      .select("*, client:clients(id, name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const clients = (clientsRes.data ?? []) as Pick<
    Client,
    "id" | "name" | "bonus_balance"
  >[];
  const transactions = (txRes.data ?? []) as unknown as BonusTransaction[];

  const totalBalance = clients.reduce((s, c) => s + Number(c.bonus_balance ?? 0), 0);
  const accrued = transactions
    .filter((t) => t.type !== "redeem")
    .reduce((s, t) => s + Number(t.points ?? 0), 0);
  const redeemed = transactions
    .filter((t) => t.type === "redeem")
    .reduce((s, t) => s + Math.abs(Number(t.points ?? 0)), 0);

  return (
    <>
      <PageHeader
        title="Бонусная система"
        description="1 % от суммы завершённого заказа начисляется автоматически. Здесь — ручные операции и история движения баллов."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Баллов на балансах"
          value={formatNumber(totalBalance)}
          hint={`клиентов с баллами: ${clients.filter((c) => Number(c.bonus_balance) > 0).length}`}
        />
        <StatCard label="Начислено (последние 100 операций)" value={formatNumber(accrued)} />
        <StatCard label="Списано (последние 100 операций)" value={formatNumber(redeemed)} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Ручная операция</CardTitle>
        </CardHeader>
        <CardContent>
          <BonusForm
            clients={clients.map((c) => ({
              id: c.id,
              name: c.name,
              bonus_balance: Number(c.bonus_balance ?? 0),
            }))}
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Балансы клиентов</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {clients.slice(0, 12).map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 px-6 py-2.5 transition-colors"
                  >
                    <span className="truncate text-sm">{client.name}</span>
                    <span className="font-semibold tabular-nums">
                      {formatNumber(Number(client.bonus_balance ?? 0))}
                    </span>
                  </Link>
                </li>
              ))}
              {!clients.length && (
                <li className="text-muted-foreground px-6 py-10 text-center text-sm">
                  Клиентов пока нет
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>История операций</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Дата</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Операция</TableHead>
                    <TableHead className="text-right">Баллы</TableHead>
                    <TableHead>Основание</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length ? (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(tx.created_at)}
                        </TableCell>
                        <TableCell>
                          {tx.client ? (
                            <Link
                              href={`/clients/${tx.client.id}`}
                              className="hover:text-primary"
                            >
                              {tx.client.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {BONUS_TYPE_LABELS[tx.type]}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={
                            tx.type === "redeem"
                              ? "text-right font-medium tabular-nums text-red-600"
                              : "text-right font-medium tabular-nums text-emerald-600"
                          }
                        >
                          {tx.type === "redeem" ? "−" : "+"}
                          {formatNumber(Math.abs(Number(tx.points ?? 0)))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tx.comment ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                        Операций пока не было
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground mt-4 text-xs">
        Баланс в рублёвом эквиваленте: {formatMoney(totalBalance)} (1 балл = 1 ₽ при списании).
      </p>
    </>
  );
}
