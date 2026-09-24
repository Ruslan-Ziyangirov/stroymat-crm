import { Badge } from "@/components/ui/badge";
import { DEAL_PRIORITY_LABELS, DEAL_PRIORITY_STYLES, DEAL_STAGE_LABELS, DEAL_STAGE_STYLES } from "@/lib/constants";
import type { DealPriority, DealStage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DealStageBadge({ stage }: { stage: DealStage }) {
  return (
    <Badge variant="outline" className={cn("font-medium", DEAL_STAGE_STYLES[stage])}>
      {DEAL_STAGE_LABELS[stage]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: DealPriority }) {
  return (
    <Badge variant="outline" className={cn("font-medium", DEAL_PRIORITY_STYLES[priority])}>
      {DEAL_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
