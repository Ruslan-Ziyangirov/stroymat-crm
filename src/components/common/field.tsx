import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  hint,
  source,
  htmlFor,
  className,
  children,
}: {
  label: string;
  error?: string;
  /** Что ввести в поле. */
  hint?: string;
  /** Где взять это значение — показывается отдельной строкой под hint. */
  source?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        (hint || source) && (
          <div className="space-y-0.5">
            {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
            {source && <p className="text-muted-foreground/70 text-xs italic">Где взять: {source}</p>}
          </div>
        )
      )}
    </div>
  );
}
