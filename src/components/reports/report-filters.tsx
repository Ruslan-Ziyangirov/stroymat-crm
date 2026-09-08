"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Store } from "@/lib/types";

const ALL = "__all__";

export function ReportFilters({
  stores,
  storeId,
  months,
}: {
  stores: Pick<Store, "id" | "name">[];
  storeId?: string;
  months: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={storeId ?? ALL}
        onValueChange={(value) => setParam("store", value === ALL ? null : value)}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Все магазины</SelectItem>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(months)} onValueChange={(value) => setParam("months", value)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">3 месяца</SelectItem>
          <SelectItem value="6">6 месяцев</SelectItem>
          <SelectItem value="12">12 месяцев</SelectItem>
          <SelectItem value="24">24 месяца</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
