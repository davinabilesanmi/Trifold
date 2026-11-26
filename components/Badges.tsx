import { MOVEMENT_LABELS, isMovementType, type StockStatus } from "@/lib/stock";

const STATUS_TEXT: Record<StockStatus, string> = { OUT: "Out of stock", LOW: "Low stock", OK: "In stock" };

export function StatusBadge({ status }: { status: StockStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_TEXT[status]}</span>;
}

export function MovementBadge({ type }: { type: string }) {
  const label = isMovementType(type) ? MOVEMENT_LABELS[type] : type;
  return <span className={`badge badge-move-${type.toLowerCase()}`}>{label}</span>;
}

export function ArchivedBadge() {
  return <span className="badge badge-archived">Archived</span>;
}
