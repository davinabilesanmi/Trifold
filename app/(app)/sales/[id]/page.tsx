import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { canSeeSale } from "@/lib/scope";
import { saleBalance } from "@/lib/balances";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PRICE_LEVEL_LABELS, isPriceLevel } from "@/lib/money";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cancelSaleAction, recordPaymentAction } from "@/lib/actions/sales";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PrintButton } from "@/components/PrintButton";
import { PaymentStatus } from "@/components/SalesTable";

export default async function SalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;
  const [sale, settings] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        location: true,
        user: { select: { name: true } },
        lines: { include: { product: { select: { name: true, sku: true, unit: true } } } },
        payments: { orderBy: { paidAt: "asc" }, include: { user: { select: { name: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!sale || !canSeeSale(user, sale)) notFound();
  const paid = sale.payments.reduce((s, p) => s + p.amountCents, 0);
  const balance = saleBalance(sale);
  const cancelled = sale.status === "CANCELLED";
  const opening = sale.kind === "OPENING_BALANCE";

  return (
    <>
      <div className="page-header no-print">
        <div>
          <h1>{opening ? "Opening balance" : "Invoice"} {sale.number}</h1>
          <p className="muted">
            <PaymentStatus sale={sale} /> · {sale.location ? `sold from ${sale.location.name}` : "owed before Trifold started using the system"} · recorded by {sale.user.name}
          </p>
        </div>
        <div className="page-actions">
          <PrintButton label="Print invoice" />
          {!opening && <Link href={`/receipts/${sale.id}`} className="btn btn-secondary" target="_blank">Print receipt</Link>}
          <Link href="/sales/new" className="btn btn-primary">New sale</Link>
        </div>
      </div>
      {created && <p className="alert alert-success page-alert no-print" role="status">Sale saved.</p>}
      {cancelled && (
        <p className="alert alert-warn page-alert">
          Cancelled {sale.cancelledAt && formatDateTime(sale.cancelledAt)}: {sale.cancelReason}. Stock was returned and payments refunded.
        </p>
      )}

      <article className="card invoice">
        <header className="invoice-head">
          <div>
            <div className="invoice-business">{settings.businessName}</div>
            {settings.address && <div className="pre muted">{settings.address}</div>}
            <div className="muted">{[settings.phone, settings.email].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="invoice-meta">
            <div className="invoice-title">{cancelled ? "CANCELLED " : ""}{opening ? "STATEMENT" : "INVOICE"}</div>
            <dl className="details">
              <dt>Number</dt><dd>{sale.number}</dd>
              <dt>Date</dt><dd>{formatDateTime(sale.createdAt)}</dd>
              {!opening && <><dt>Prices</dt><dd>{isPriceLevel(sale.priceLevel) ? PRICE_LEVEL_LABELS[sale.priceLevel] : sale.priceLevel}</dd></>}
            </dl>
          </div>
        </header>

        <section className="invoice-to">
          <div className="muted small">Bill to</div>
          {sale.customer ? (
            <>
              <strong><Link href={`/customers/${sale.customer.id}`}>{sale.customer.name}</Link></strong>
              {sale.customer.address && <div className="pre">{sale.customer.address}</div>}
              {sale.customer.phone && <div>{sale.customer.phone}</div>}
            </>
          ) : <strong>Walk-in customer</strong>}
        </section>

        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {opening && (
                <tr><td>Balance brought forward</td><td className="num">—</td><td className="num">—</td><td className="num nowrap">{formatMoney(sale.totalCents)}</td></tr>
              )}
              {sale.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.product.name} <span className="muted small">{l.product.sku}</span></td>
                  <td className="num nowrap">
                    {formatNumber(l.quantity)} {l.packName ? l.packName.toLowerCase() : l.product.unit}
                    {l.packName && <div className="muted small">= {formatNumber(l.quantity * l.unitsPerPack)} {l.product.unit}</div>}
                  </td>
                  <td className="num nowrap">{formatMoney(l.unitPriceCents)}</td>
                  <td className="num nowrap">{formatMoney(l.quantity * l.unitPriceCents)}</td>
                </tr>
              ))}
              {sale.discountCents > 0 && (
                <>
                  <tr><td colSpan={3} className="num">Subtotal</td><td className="num nowrap">{formatMoney(sale.totalCents + sale.discountCents)}</td></tr>
                  <tr><td colSpan={3} className="num">Discount</td><td className="num nowrap">−{formatMoney(sale.discountCents)}</td></tr>
                </>
              )}
              <tr className="invoice-total"><td colSpan={3} className="num">Total{sale.vatRate > 0 ? " (VAT inclusive)" : ""}</td><td className="num nowrap">{formatMoney(sale.totalCents)}</td></tr>
              {sale.vatRate > 0 && (
                <tr><td colSpan={3} className="num muted">Includes VAT at {sale.vatRate}%</td><td className="num nowrap muted">{formatMoney(sale.vatCents)}</td></tr>
              )}
              {!cancelled && (
                <>
                  <tr><td colSpan={3} className="num">Paid</td><td className="num nowrap">{formatMoney(paid)}</td></tr>
                  <tr className="invoice-total"><td colSpan={3} className="num">Balance due</td><td className="num nowrap">{formatMoney(balance)}</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {sale.note && <p><span className="muted small">Note:</span> {sale.note}</p>}
        {balance > 0 && settings.bankDetails && (
          <div className="invoice-bank"><div className="muted small">Pay to</div><div className="pre">{settings.bankDetails}</div></div>
        )}
        {settings.invoiceFooter && <p className="invoice-footer muted">{settings.invoiceFooter}</p>}
      </article>

      <div className="grid-2 no-print" style={{ marginTop: "1.25rem" }}>
        <section className="card">
          <h2>Payments</h2>
          {sale.payments.length === 0 ? <p className="empty">No payments recorded.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="num">Amount</th><th>By</th></tr></thead>
                <tbody>
                  {sale.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="nowrap">{formatDateTime(p.paidAt)}</td>
                      <td>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                      <td>{p.reference}</td>
                      <td className={`num nowrap ${p.amountCents < 0 ? "neg" : ""}`}>{formatMoney(p.amountCents)}</td>
                      <td className="nowrap">{p.user.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!cancelled && (
          <div>
            {balance > 0 && can.takePayments(user) && (
              <section className="card">
                <h2>Record a payment</h2>
                <ActionForm action={recordPaymentAction.bind(null, sale.id)} resetOnSuccess>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="amount">Amount (₦)</label>
                      <input id="amount" name="amount" type="text" inputMode="decimal" required placeholder={(balance / 100).toFixed(2)} />
                      <span className="hint">{formatMoney(balance)} outstanding</span>
                    </div>
                    <div className="field">
                      <label htmlFor="method">Method</label>
                      <select id="method" name="method" defaultValue="TRANSFER">
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="pref">Reference</label>
                    <input id="pref" name="reference" type="text" maxLength={100} placeholder="Optional" />
                  </div>
                  <div className="form-actions"><SubmitButton>Record payment</SubmitButton></div>
                </ActionForm>
              </section>
            )}
            {can.cancelSales(user) && (
              <section className="card">
                <h2>{opening ? "Remove opening balance" : "Cancel sale"}</h2>
                <p className="muted small" style={{ marginTop: 0 }}>
                  {sale.location ? `Returns the stock to ${sale.location.name} and records` : "Removes this balance and records"} a refund of {formatMoney(paid)}.
                </p>
                <ActionForm action={cancelSaleAction.bind(null, sale.id)}>
                  <div className="field">
                    <label htmlFor="reason">Reason</label>
                    <input id="reason" name="reason" type="text" required maxLength={200} placeholder="e.g. Customer returned goods" />
                  </div>
                  <div className="form-actions"><SubmitButton variant="danger" pendingText="Cancelling…">{opening ? "Remove balance" : "Cancel sale"}</SubmitButton></div>
                </ActionForm>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
