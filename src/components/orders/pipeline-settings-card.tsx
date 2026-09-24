"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePipelineSettings } from "@/lib/actions/pipeline";

/** Лимит активных сделок на менеджера — редактируется только руководством. */
export function PipelineSettingsCard({ limit }: { limit: number }) {
  const router = useRouter();
  const [value, setValue] = React.useState(String(limit));
  const [pending, startTransition] = React.useTransition();

  const onSave = () => {
    const n = Number(value);
    startTransition(async () => {
      const result = await savePipelineSettings(n);
      if (!result.ok) {
        toast.error(result.error ?? "Не удалось сохранить");
        return;
      }
      toast.success("Лимит сохранён");
      router.refresh();
    });
  };

  return (
    <div className="bg-card flex items-center gap-2 rounded-2xl p-3 text-sm shadow-sm">
      <span className="text-muted-foreground">Лимит активных сделок на менеджера</span>
      <Input
        type="number"
        min="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20"
      />
      <Button size="sm" variant="outline" onClick={onSave} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Сохранить
      </Button>
    </div>
  );
}
