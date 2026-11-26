import { Fragment } from "react";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { parseDateRange, todayInLagos } from "@/lib/dates";
import { creditors, debtors, salesSummary, stockValuation } from "@/lib/reports";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";
import { formatMoney, formatNumber } from "@/lib/format";
import { isRestricted } from "@/lib/scope";

export const metadata = { title: "Period report" };

function Export({ report, qs, label = "Download CSV" }: { report: string; qs?: string; label?: string }) {
  return <a className="small" href={`/api/export/${report}${qs ? `?${qs}` : ""}`} download>{label}</a>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requirePermission(can.viewReports);
  const money = can.viewFinancials(user);
  const restricted = isRestricted(user);
  const sp = await searchParams;
  const today = todayInLagos();
  const { from, to, createdAt } = parseDateRange(sp.from ?? `${today.slice(0, 8)}01`, sp.to ?? today);
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();

  const [sales, stock, owedToUs, weOwe] = await Promise.all([
    salesSummary(createdAt, user.locationIds), stockValuation(user.locationIds),
    restricted ? [] : debtors(), restricted ? [] : creditors(),
  ]);
  const margin = sales.revenue > 0 ? Math.round((sales.profit / sales.revenue) * 1000) / 10 : 0;
  const stockCost = stock.reduce((s, r) => s + r.costValue, 0);
  const stockRetail = stock.reduce((s, r) => s + r.retailValue, 0);

  return (
    <>
      <form className="filters" method="get">
        <label className="small">From <input type="date" name="from" defaultValue={from} /></label>
        <label className="small">To <input type="date" name="to" defaultValue={to} /></label>
        <button className="btn btn-secondary" type="submit">Update</button>
        <Link className="small" href={`/reports/period?from=${today}&to=${today}`}>Today</Link>
        <Link className="small" href="/reports/period">This month</Link>
        <Link className="small" href={`/reports/period?from=${today.slice(0, 4)}-01-01&to=${today}`}>This year</Link>
      </form>

      <section className="stats">
        <div className="stat"><div className="stat-label">Sales</div><div className="stat-value">{formatNumber(sales.saleCount)}</div></div>
        <div className="stat"><div className="stat-label">Revenue</div><div className="stat-value">{formatMoney(sales.revenue, { whole: true })}</div></div>
        {money && <>
          <div className="stat"><div className="stat-label">Cost of goods sold</div><div className="stat-value">{formatMoney(sales.cost, { whole: true })}</div></div>
          <div className="stat"><div className="stat-label">Gross profit ({margin}%)</div><div className="stat-value">{formatMoney(sales.profit, { whole: true })}</div></div>
        </>}
      </section>

      <div className="stack">
        <section className="card">
          <div className="section-head">
            <h2>Sales by product</h2>
            <span className="form-actions"><Export report="sales-by-product" qs={qs} /><Export report="sales" qs={qs} label="All invoices (CSV)" /></span>
          </div>
          {sales.products.length === 0 ? <p className="empty">No sales in this period.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Qty sold</th><th className="num">Revenue</th>{money && <><th className="num">Cost</th><th className="num">Profit</th></>}</tr></thead>
                <tbody>
                  {sales.products.map((p) => (
                    <tr key={p.product.id}>
                      <td><Link href={`/products/${p.product.id}`}>{p.product.name}</Link> <span className="muted small">{p.product.sku}</span></td>
                      <td className="num">{formatNumber(p.quantity)} <span className="muted small">{p.product.unit}</span></td>
                      <td className="num nowrap">{formatMoney(p.revenue)}</td>
                      {money && <>
                        <td className="num nowrap">{formatMoney(p.cost)}</td>
                        <td className={`num nowrap ${p.revenue - p.cost < 0 ? "neg" : ""}`}>{formatMoney(p.revenue - p.cost)}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {money && <p className="muted small">Cost uses each product&apos;s cost at the time of sale.</p>}
        </section>

        <div className="grid-2">
          <section className="card">
            <div className="section-head"><h2>Money received</h2><Export report="payments" qs={qs} /></div>
            {sales.payments.length === 0 ? <p className="empty">No payments in this period.</p> : (
              <dl className="details">
                {sales.payments.map((p) => (
                  <Fragment key={p.method}><dt>{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</dt><dd>{formatMoney(p.amountCents)}</dd></Fragment>
                ))}
                <dt><strong>Total</strong></dt><dd><strong>{formatMoney(sales.payments.reduce((s, p) => s + p.amountCents, 0))}</strong></dd>
              </dl>
            )}
          </section>
          <section className="card">
            <div className="section-head"><h2>Stock value now</h2><Export report="stock" /></div>
            <dl className="details">
              <dt>Units on hand</dt><dd>{formatNumber(stock.reduce((s, r) => s + r.quantity, 0))}</dd>
              {money && <><dt>At cost</dt><dd>{formatMoney(stockCost)}</dd></>}
              <dt>At retail price</dt><dd>{formatMoney(stockRetail)}</dd>
            </dl>
            <p className="muted small">The stock download lists every product with quantities per location.</p>
          </section>
        </div>

        {!restricted && <div className="grid-2">
          <section className="card">
            <div className="section-head"><h2>Customers who owe Trifold</h2><Export report="debtors" /></div>
            {owedToUs.length === 0 ? <p className="empty">Nobody owes money.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Customer</th><th>Phone</th><th className="num">Owes</th></tr></thead>
                  <tbody>
                    {owedToUs.map((r) => (
                      <tr key={r.customer.id}>
                        <td><Link href={`/customers/${r.customer.id}`}>{r.customer.name}</Link></td>
                        <td className="nowrap">{r.customer.phone}</td>
                        <td className="num nowrap neg">{formatMoney(r.balance)}</td>
                      </tr>
                    ))}
                    <tr><td colSpan={2}><strong>Total</strong></td><td className="num nowrap"><strong>{formatMoney(owedToUs.reduce((s, r) => s + r.balance, 0))}</strong></td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card">
            <div className="section-head"><h2>Suppliers Trifold owes</h2><Export report="creditors" /></div>
            {weOwe.length === 0 ? <p className="empty">Trifold owes no suppliers.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Supplier</th><th className="num">Owed</th></tr></thead>
                  <tbody>
                    {weOwe.map((r) => (
                      <tr key={r.supplier.id}>
                        <td><Link href={`/suppliers/${r.supplier.id}`}>{r.supplier.name}</Link></td>
                        <td className="num nowrap">{formatMoney(r.balance)}</td>
                      </tr>
                    ))}
                    <tr><td><strong>Total</strong></td><td className="num nowrap"><strong>{formatMoney(weOwe.reduce((s, r) => s + r.balance, 0))}</strong></td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>}

        <section className="card">
          <div className="section-head"><h2>Stock movement log</h2><Export report="movements" qs={qs} /></div>
          <p className="muted small" style={{ margin: 0 }}>Every receipt, issue, transfer and adjustment in the selected period, for audits and stock checks.</p>
        </section>
      </div>
    </>
  );
}
