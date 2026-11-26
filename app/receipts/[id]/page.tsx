import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSeeSale } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { saleBalance } from "@/lib/balances";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Receipt" };

/** A narrow till receipt for 80 mm thermal printers. */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [sale, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true, location: true, user: { select: { name: true } },
        lines: { include: { product: { select: { name: true, unit: true } } } },
        payments: { orderBy: { paidAt: "asc" } },
      },
    }),
    getSettings(),
  ]);
  if (!sale || !canSeeSale(user, sale)) notFound();
  const paid = sale.payments.reduce((s, p) => s + p.amountCents, 0);
  const balance = saleBalance(sale);

  return (
    <main className="receipt-page">
      <div className="receipt-actions no-print">
        <PrintButton label="Print receipt" />
        <Link href={`/sales/${sale.id}`} className="btn btn-secondary">Back to invoice</Link>
      </div>
      <article className="receipt">
        <header>
          <div className="receipt-business">{settings.businessName}</div>
          {settings.address && <div className="pre">{settings.address}</div>}
          {settings.phone && <div>{settings.phone}</div>}
          {sale.location && <div>{sale.location.name}</div>}
        </header>
        <hr />
        <div className="receipt-row"><span>Receipt</span><span>{sale.number}</span></div>
        <div className="receipt-row"><span>Date</span><span>{formatDateTime(sale.createdAt)}</span></div>
        <div className="receipt-row"><span>Customer</span><span>{sale.customer?.name ?? "Walk-in"}</span></div>
        {sale.status === "CANCELLED" && <div className="receipt-cancelled">CANCELLED</div>}
        <hr />
        {sale.lines.map((l) => (
          <div key={l.id} className="receipt-item">
            <div>{l.product.name}</div>
            <div className="receipt-row">
              <span>{formatNumber(l.quantity)} {l.packName ? l.packName.toLowerCase() : l.product.unit} × {formatMoney(l.unitPriceCents)}</span>
              <span>{formatMoney(l.quantity * l.unitPriceCents)}</span>
            </div>
          </div>
        ))}
        <hr />
        {sale.discountCents > 0 && (
          <>
            <div className="receipt-row"><span>Subtotal</span><span>{formatMoney(sale.totalCents + sale.discountCents)}</span></div>
            <div className="receipt-row"><span>Discount</span><span>−{formatMoney(sale.discountCents)}</span></div>
          </>
        )}
        <div className="receipt-row receipt-total"><span>TOTAL</span><span>{formatMoney(sale.totalCents)}</span></div>
        {sale.vatRate > 0 && <div className="receipt-row"><span>Incl. VAT {sale.vatRate}%</span><span>{formatMoney(sale.vatCents)}</span></div>}
        {sale.payments.filter((p) => p.amountCents > 0).map((p) => (
          <div key={p.id} className="receipt-row"><span>Paid ({PAYMENT_METHOD_LABELS[p.method] ?? p.method})</span><span>{formatMoney(p.amountCents)}</span></div>
        ))}
        {paid !== sale.totalCents && sale.status === "COMPLETED" && (
          <div className="receipt-row receipt-total"><span>BALANCE DUE</span><span>{formatMoney(balance)}</span></div>
        )}
        {settings.vatNote && <div className="receipt-footer" style={{ marginTop: 4 }}>{settings.vatNote}</div>}
        <hr />
        <div className="receipt-row"><span>Served by</span><span>{sale.user.name}</span></div>
        {settings.invoiceFooter && <p className="receipt-footer">{settings.invoiceFooter}</p>}
      </article>
    </main>
  );
}
