import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { purchaseOrderValue } from "@/lib/purchasing";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/money";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { closePurchaseOrderAction, paySupplierAction, receivePurchaseOrderAction } from "@/lib/actions/purchases";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { PrintButton } from "@/components/PrintButton";
import { PoStatusBadge } from "@/components/PurchaseOrdersTable";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true, location: true, user: { select: { name: true } },
      lines: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      payments: { orderBy: { paidAt: "asc" }, include: { user: { select: { name: true } } } },
    },
  });
  if (!po) notFound();
  const value = purchaseOrderValue(po, po.lines);
  const paid = po.payments.reduce((s, p) => s + p.amountCents, 0);
  const balance = value - paid;
  const open = po.status === "ORDERED" || po.status === "PARTIAL";
  const manage = can.managePurchasing(user);
  const opening = po.kind === "OPENING_BALANCE";

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{opening ? "Opening balance" : "Purchase order"} {po.number}</h1>
          <p className="muted">
            <PoStatusBadge status={po.status} kind={po.kind} /> · <Link href={`/suppliers/${po.supplier.id}`}>{po.supplier.name}</Link>
            {po.location ? ` · deliver to ${po.location.name}` : " · owed before Trifold started using the system"} · created {formatDateTime(po.createdAt)} by {po.user.name}
          </p>
        </div>
        <div className="page-actions no-print"><PrintButton /></div>
      </div>

      <section className="stats">
        <div className="stat"><div className="stat-label">{opening ? "Amount owed at start" : po.status === "RECEIVED" ? "Value received" : "Order value"}</div><div className="stat-value">{formatMoney(value)}</div></div>
        <div className="stat"><div className="stat-label">Paid to supplier</div><div className="stat-value">{formatMoney(paid)}</div></div>
        <div className={balance > 0 ? "stat stat-warn" : "stat"}><div className="stat-label">{balance < 0 ? "Supplier owes Trifold" : "Still to pay"}</div><div className="stat-value">{formatMoney(Math.abs(balance))}</div></div>
      </section>

      {!opening && <section className="card">
        <h2>Items</h2>
        <ActionForm action={receivePurchaseOrderAction.bind(null, po.id)}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Product</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Unit cost</th><th className="num">Amount</th>
                  {open && can.receivePurchases(user) && <th className="num no-print">Receive now</th>}</tr>
              </thead>
              <tbody>
                {po.lines.map((l) => {
                  const remaining = l.quantity - l.receivedQuantity;
                  return (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/products/${l.product.id}`}>{l.product.name}</Link> <span className="muted small">{l.product.sku}</span>
                        {l.packName && <div className="muted small">{l.packName} of {l.unitsPerPack} {l.product.unit}</div>}
                      </td>
                      <td className="num nowrap">{formatNumber(l.quantity)} {l.packName ? l.packName.toLowerCase() : l.product.unit}</td>
                      <td className="num nowrap">{formatNumber(l.receivedQuantity)}</td>
                      <td className="num nowrap">{formatMoney(l.unitCostCents)}</td>
                      <td className="num nowrap">{formatMoney(l.quantity * l.unitCostCents)}</td>
                      {open && can.receivePurchases(user) && (
                        <td className="num no-print" style={{ width: 120 }}>
                          {remaining > 0 ? (
                            <input type="number" name={`receive:${l.id}`} min={0} max={remaining} step={1} defaultValue={remaining}
                              aria-label={`Receive ${l.product.name}`} style={{ textAlign: "right" }} />
                          ) : <span className="muted small">Complete</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {open && can.receivePurchases(user) && (
            <div className="form-actions no-print">
              <SubmitButton pendingText="Receiving…">Receive delivery into {po.location?.name}</SubmitButton>
              <span className="muted small">Adjust the quantities to what actually arrived.</span>
            </div>
          )}
        </ActionForm>
        {po.note && <p><span className="muted small">Note:</span> {po.note}</p>}
      </section>}
      {opening && po.note && <p><span className="muted small">Note:</span> {po.note}</p>}

      <div className="grid-2 no-print" style={{ marginTop: "1.25rem" }}>
        <section className="card">
          <h2>Payments to supplier</h2>
          {po.payments.length === 0 ? <p className="empty">No payments yet.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="num">Amount</th><th>By</th></tr></thead>
                <tbody>
                  {po.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="nowrap">{formatDateTime(p.paidAt)}</td>
                      <td>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</td>
                      <td>{p.reference}</td>
                      <td className="num nowrap">{formatMoney(p.amountCents)}</td>
                      <td className="nowrap">{p.user.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {manage && po.status !== "CANCELLED" && (
          <div>
            {balance > 0 && (
              <section className="card">
                <h2>Pay supplier</h2>
                <ActionForm action={paySupplierAction.bind(null, po.id)} resetOnSuccess>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="amount">Amount (₦)</label>
                      <input id="amount" name="amount" type="text" inputMode="decimal" required placeholder={(balance / 100).toFixed(2)} />
                      <span className="hint">{formatMoney(balance)} outstanding{po.status !== "RECEIVED" ? " (advance payments allowed)" : ""}</span>
                    </div>
                    <div className="field">
                      <label htmlFor="method">Method</label>
                      <select id="method" name="method" defaultValue="TRANSFER">
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field"><label htmlFor="ref">Reference</label><input id="ref" name="reference" type="text" maxLength={100} placeholder="Optional" /></div>
                  <div className="form-actions"><SubmitButton>Record payment</SubmitButton></div>
                </ActionForm>
              </section>
            )}
            {open && (
              <section className="card">
                <h2>{po.status === "ORDERED" ? "Cancel order" : "Close order"}</h2>
                <p className="muted small" style={{ marginTop: 0 }}>
                  {po.status === "ORDERED"
                    ? "Cancel if this order won't be delivered. Not possible once payments are recorded."
                    : "Close if the rest of this order isn't coming. Trifold will only owe for what was received."}
                </p>
                <ActionForm action={closePurchaseOrderAction.bind(null, po.id)}>
                  <div className="form-actions"><SubmitButton variant="danger">{po.status === "ORDERED" ? "Cancel order" : "Close order"}</SubmitButton></div>
                </ActionForm>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
