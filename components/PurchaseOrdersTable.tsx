import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PO_STATUS_LABELS, purchaseOrderValue } from "@/lib/purchasing";

export type PurchaseOrderRow = {
  id: string; number: string; status: string; createdAt: Date;
  supplier: { id: string; name: string }; location: { code: string };
  lines: { quantity: number; receivedQuantity: number; unitCostCents: number }[];
  payments: { amountCents: number }[];
};

export const purchaseOrderRowInclude = {
  supplier: { select: { id: true, name: true } },
  location: { select: { code: true } },
  lines: { select: { quantity: true, receivedQuantity: true, unitCostCents: true } },
  payments: { select: { amountCents: true } },
} as const;

const STATUS_BADGE: Record<string, string> = { ORDERED: "badge-move-transfer", PARTIAL: "badge-low", RECEIVED: "badge-ok", CANCELLED: "badge-archived" };

export function PoStatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_BADGE[status] ?? ""}`}>{PO_STATUS_LABELS[status] ?? status}</span>;
}

export function poBalance(po: PurchaseOrderRow) {
  return purchaseOrderValue(po, po.lines) - po.payments.reduce((s, p) => s + p.amountCents, 0);
}

export function PurchaseOrdersTable({ orders, showSupplier = true }: { orders: PurchaseOrderRow[]; showSupplier?: boolean }) {
  if (orders.length === 0) return <p className="empty">No purchase orders yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Order</th><th>Date</th>{showSupplier && <th>Supplier</th>}<th>Deliver to</th><th className="num">Value</th><th className="num">Unpaid</th><th>Status</th></tr>
        </thead>
        <tbody>
          {orders.map((po) => {
            const balance = poBalance(po);
            return (
              <tr key={po.id} className={po.status === "CANCELLED" ? "row-archived" : undefined}>
                <td className="nowrap"><Link href={`/purchases/${po.id}`}>{po.number}</Link></td>
                <td className="nowrap">{formatDateTime(po.createdAt)}</td>
                {showSupplier && <td><Link href={`/suppliers/${po.supplier.id}`}>{po.supplier.name}</Link></td>}
                <td>{po.location.code}</td>
                <td className="num nowrap">{formatMoney(purchaseOrderValue(po, po.lines))}</td>
                <td className="num nowrap">{balance > 0 ? formatMoney(balance) : "—"}</td>
                <td><PoStatusBadge status={po.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
