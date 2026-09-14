import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { DeleteFinanceUploadButton } from "@/components/reports/delete-finance-upload-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { formatDateTime, formatMoney } from "@/lib/format";
import type { FinanceStatementLine, FinanceUpload } from "@/lib/types";

export const metadata: Metadata = { title: "Бухгалтерская отчётность" };

export default async function StatementUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin", "director"]);
  const supabase = await createClient();

  const [uploadRes, linesRes] = await Promise.all([
    supabase
      .from("finance_uploads")
      .select("*")
      .eq("id", id)
      .eq("kind", "financial_statement")
      .maybeSingle(),
    supabase
      .from("finance_statement_lines")
      .select("*")
      .eq("upload_id", id)
      .order("position", { ascending: true }),
  ]);

  if (!uploadRes.data) notFound();

  const upload = uploadRes.data as unknown as FinanceUpload;
  const lines = (linesRes.data ?? []) as unknown as FinanceStatementLine[];
  const balanceLines = lines.filter((l) => l.statement_type === "balance");
  const incomeLines = lines.filter((l) => l.statement_type === "income");
  const summary = upload.summary ?? {};

  return (
    <>
      <PageHeader
        title={upload.file_name}
        description={`${upload.period_year ?? ""} г.${summary.orgName ? ` · ${summary.orgName}` : ""} · загружен ${formatDateTime(upload.created_at)}`}
        actions={<DeleteFinanceUploadButton id={upload.id} name={upload.file_name} />}
      />

      {upload.status === "failed" && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <TriangleAlert className="size-4" />
          <AlertTitle>Файл не разобран</AlertTitle>
          <AlertDescription>{upload.error}</AlertDescription>
        </Alert>
      )}

      <Alert className="mb-4">
        <AlertTitle>Значения — в тысячах рублей, как в исходной форме</AlertTitle>
        <AlertDescription>
          В таблицах ниже суммы показаны как в оригинале (тыс. ₽); на дашборде и в карточках раздела —
          уже в рублях.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Бухгалтерский баланс</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Код</TableHead>
                  <TableHead>Показатель</TableHead>
                  <TableHead className="text-right">Тыс. ₽</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balanceLines.map((line) => (
                  <TableRow key={line.id} className={line.code === "1600" || line.code === "1700" ? "font-semibold" : ""}>
                    <TableCell className="tabular-nums">{line.code}</TableCell>
                    <TableCell>{line.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.value !== null ? formatMoney(line.value, 0).replace("₽", "тыс. ₽") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!balanceLines.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                      Строки не распознаны
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Отчёт о финансовых результатах</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Код</TableHead>
                  <TableHead>Показатель</TableHead>
                  <TableHead className="text-right">Тыс. ₽</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomeLines.map((line) => (
                  <TableRow key={line.id} className={line.code === "2400" ? "font-semibold" : ""}>
                    <TableCell className="tabular-nums">{line.code}</TableCell>
                    <TableCell>{line.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.value !== null ? formatMoney(line.value, 0).replace("₽", "тыс. ₽") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!incomeLines.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground h-24 text-center">
                      Строки не распознаны
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
