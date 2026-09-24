"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { uploadCashFlow, uploadFinancialStatement } from "@/lib/actions/finance";

/** Загрузка помесячной выгрузки «Анализ счёта 51» (.xls/.xlsx). */
export function CashFlowUploadForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await uploadCashFlow(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось загрузить отчёт");
        return;
      }
      toast.success("Оборот по счёту 51 загружен");
      formRef.current?.reset();
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Отчёт за месяц</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
          <Field
            label="Файл за один месяц"
            htmlFor="cash-flow-file"
            hint="Выгрузка из 1С «Анализ счёта 51» за конкретный месяц (.xls/.xlsx). Годовые своды не подходят."
            className="min-w-64 flex-1"
          >
            <Input
              id="cash-flow-file"
              name="file"
              type="file"
              accept=".xls,.xlsx,.xlsm"
              required
              disabled={pending}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Загрузить
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Загрузка годовой бухгалтерской отчётности (баланс + ОФР), PDF. */
export function StatementUploadForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await uploadFinancialStatement(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось загрузить отчёт");
        return;
      }
      toast.success("Бухгалтерская отчётность загружена");
      formRef.current?.reset();
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Баланс и отчёт о финансовых результатах (годовой)</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
          <Field
            label="Файл за год"
            htmlFor="statement-file"
            hint="Официальная форма 0710001/0710002 из бухгалтерии, PDF."
            className="min-w-64 flex-1"
          >
            <Input
              id="statement-file"
              name="file"
              type="file"
              accept=".pdf"
              required
              disabled={pending}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Загрузить
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
