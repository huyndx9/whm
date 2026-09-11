import type { CategoryId, ExpiryStatus, PurchaseOrderStatus, StockStatus } from "../types";
import {
  categoryLabel,
  categoryStyle,
  expiryStatusStyle,
  purchaseOrderStatusLabel,
  purchaseOrderStatusStyle,
  stockStatusLabel,
  stockStatusStyle,
} from "../lib/labels";
import { formatRemainingDays } from "../lib/format";
import { Badge } from "./ui";

export function CategoryBadge({ categoryId }: { categoryId: CategoryId }) {
  const s = categoryStyle[categoryId];
  return (
    <Badge className={`${s.bg} ${s.text} ${s.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {categoryLabel[categoryId]}
    </Badge>
  );
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const s = stockStatusStyle[status];
  return (
    <Badge className={`${s.bg} ${s.text} border-transparent`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {stockStatusLabel[status]}
    </Badge>
  );
}

export function ExpiryBadge({ days, status }: { days: number; status: ExpiryStatus }) {
  const s = expiryStatusStyle[status];
  return (
    <Badge className={`${s.bg} ${s.text} ${s.border}`}>{formatRemainingDays(days)}</Badge>
  );
}

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const s = purchaseOrderStatusStyle[status];
  return (
    <Badge className={`${s.bg} ${s.text} ${s.border}`}>{purchaseOrderStatusLabel[status]}</Badge>
  );
}
