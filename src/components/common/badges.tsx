import { Badge } from "@/components/ui/badge";
import {
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_STYLES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/constants";
import type { ClientStatus, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ORDER_STATUS_STYLES[status])}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", CLIENT_STATUS_STYLES[status])}>
      {CLIENT_STATUS_LABELS[status]}
    </Badge>
  );
}
