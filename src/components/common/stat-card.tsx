import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  /** Прирост к предыдущему периоду, %. null — сравнивать не с чем. */
  delta?: number | null;
  hint?: string;
  /** Для метрик, где рост — это плохо (например, отмены). */
  invert?: boolean;
}

export function StatCard({ label, value, delta, hint, invert }: StatCardProps) {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const positive = hasDelta ? (invert ? delta! < 0 : delta! > 0) : false;
  const neutral = hasDelta ? Math.abs(delta!) < 0.05 : true;
  const Icon = !hasDelta || neutral ? ArrowRight : delta! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {hasDelta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              neutral
                ? "bg-muted text-muted-foreground"
                : positive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700",
            )}
          >
            <Icon className="size-3" />
            {Math.abs(delta!).toFixed(1).replace(".", ",")} %
          </span>
        ) : (
          <span className="text-muted-foreground">нет данных для сравнения</span>
        )}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
    </div>
  );
}
