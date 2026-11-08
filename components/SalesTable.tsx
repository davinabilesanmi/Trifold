import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { saleBalance } from "@/lib/balances";

export type SaleRow = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  customer: { id: string; name: string } | null;
  location: { code: string };
  user: { name: string };
  payments: { amountCents: number }[];
};

export const saleRowInclude = {
  customer: { select: { id: true, name: true } },
  location: { select: { code: true } },
  user: { select: { name: true } },
  payments: { select: { amountCents: true } },
} as const;

export function PaymentStatus({ sale }: { sale: SaleRow }) {
  if (sale.status === "CANCELLED") return <span className="badge badge-archived">Cancelled</span>;
  const balance = saleBalance(sale);
  if (balance <= 0) return <span className="badge badge-ok">Paid</span>;
  if (balance < sale.totalCents) return <span className="badge badge-low">Part paid</span>;
  return <span className="badge badge-out">Unpaid</span>;
}

export function SalesTable({ sales, showCustomer = true }: { sales: SaleRow[]; showCustomer?: boolean }) {
  if (sales.length === 0) return <p className="empty">No sales yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Invoice</th><th>Date</th>{showCustomer && <th>Customer</th>}<th>From</th>
            <th className="num">Total</th><th className="num">Balance</th><th>Status</th><th>By</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} className={s.status === "CANCELLED" ? "row-archived" : undefined}>
              <td className="nowrap"><Link href={`/sales/${s.id}`}>{s.number}</Link></td>
              <td className="nowrap">{formatDateTime(s.createdAt)}</td>
              {showCustomer && (
                <td>{s.customer ? <Link href={`/customers/${s.customer.id}`}>{s.customer.name}</Link> : <span className="muted">Walk-in</span>}</td>
              )}
              <td>{s.location.code}</td>
              <td className="num nowrap">{formatMoney(s.totalCents)}</td>
              <td className="num nowrap">{saleBalance(s) > 0 ? formatMoney(saleBalance(s)) : "—"}</td>
              <td><PaymentStatus sale={s} /></td>
              <td className="nowrap">{s.user.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
