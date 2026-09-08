import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { IntegrationForm } from "@/components/integration/integration-form";
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
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { IntegrationSettings, SyncLogEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Интеграция с 1С" };

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/1c/clients?since=2026-01-01T00:00:00Z",
    description: "Выгрузка клиентов из CRM в 1С",
  },
  {
    method: "POST",
    path: "/api/1c/clients",
    description: "Загрузка клиентов из 1С (upsert по external_1c_id)",
  },
  {
    method: "GET",
    path: "/api/1c/orders?since=…&status=completed",
    description: "Выгрузка заказов с составом и суммами",
  },
  {
    method: "POST",
    path: "/api/1c/orders",
    description: "Загрузка заказов из 1С, суммы пересчитываются в CRM",
  },
  {
    method: "GET",
    path: "/api/1c/bonuses?client=…",
    description: "Текущие бонусные балансы клиентов",
  },
  {
    method: "POST",
    path: "/api/1c/bonuses",
    description: "Проведение бонусных начислений и списаний из 1С",
  },
];

const SAMPLE = `POST /api/1c/orders
x-api-key: <INTEGRATION_1C_API_KEY>
Content-Type: application/json

{
  "orders": [
    {
      "external_1c_id": "00-000123",
      "client_external_id": "К-000045",
      "status": "completed",
      "discount_percent": 3,
      "items": [
        { "name": "Цемент М500, 50 кг", "unit": "меш", "quantity": 40, "price": 620 }
      ]
    }
  ]
}`;

export default async function IntegrationPage() {
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [settingsRes, logRes] = await Promise.all([
    supabase.from("integration_settings").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const settings = (settingsRes.data ?? {
    id: true,
    is_enabled: false,
    base_url: null,
    username: null,
    sync_clients: true,
    sync_orders: true,
    sync_bonuses: true,
    last_sync_at: null,
    updated_at: new Date().toISOString(),
  }) as IntegrationSettings;

  const log = (logRes.data ?? []) as unknown as SyncLogEntry[];

  return (
    <>
      <PageHeader
        title="Интеграция с 1С"
        description={
          settings.last_sync_at
            ? `Последний обмен: ${formatDateTime(settings.last_sync_at)}`
            : "Обмена ещё не было"
        }
        actions={
          <Badge
            variant="outline"
            className={
              settings.is_enabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-muted text-muted-foreground"
            }
          >
            {settings.is_enabled ? "Интеграция активна" : "Интеграция выключена"}
          </Badge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <IntegrationForm settings={settings} />

        <Card>
          <CardHeader>
            <CardTitle>HTTP-методы обмена</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Все запросы требуют заголовок <code className="font-mono">x-api-key</code> со
              значением переменной окружения <code className="font-mono">INTEGRATION_1C_API_KEY</code>.
            </p>

            <ul className="space-y-2">
              {ENDPOINTS.map((endpoint) => (
                <li key={`${endpoint.method}-${endpoint.path}`} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        endpoint.method === "GET"
                          ? "border-sky-200 bg-sky-50 font-mono text-sky-700"
                          : "border-amber-200 bg-amber-50 font-mono text-amber-700"
                      }
                    >
                      {endpoint.method}
                    </Badge>
                    <code className="text-xs break-all">{endpoint.path}</code>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{endpoint.description}</p>
                </li>
              ))}
            </ul>

            <div>
              <p className="mb-2 text-sm font-medium">Пример запроса</p>
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                <code>{SAMPLE}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Журнал обмена</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Время</TableHead>
                  <TableHead>Направление</TableHead>
                  <TableHead>Сущность</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Сообщение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.length ? (
                  log.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        {entry.direction === "in" ? "1С → CRM" : "CRM → 1С"}
                      </TableCell>
                      <TableCell>{entry.entity}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            entry.status === "ok"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }
                        >
                          {entry.status === "ok" ? "Успешно" : "Ошибка"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      Обменов ещё не было
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
