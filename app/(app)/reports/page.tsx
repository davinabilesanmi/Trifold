import { Fragment } from "react";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dailyReport } from "@/lib/daily";
import { startOfDay, todayInLagos } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/money";
import { isRestricted, locationWhere } from "@/lib/scope";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Daily report" };

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ date?: string; location?: string }> }) {
  const user = await requirePermission(can.viewReports);
  const sp = await searchParams;
  const today = todayInLagos();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const locations = await prisma.location.findMany({ where: { active: true, ...locationWhere(user) }, orderBy: { name: "asc" } });
  const chosen = sp.location && locations.some((l) => l.id === sp.location) ? sp.location : "";
  const locationIds = chosen ? [chosen] : isRestricted(user) ? user.locationIds : [];
  const start = startOfDay(date);
  const report = await dailyReport(start, new Date(start.getTime() + 86_400_000), user, locationIds);
  const t = report.totals;
  const dateLabel = new Intl.DateTimeFormat("en-NG", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const where = chosen ? locations.find((l) => l.id === chosen)!.name : isRestricted(user) ? locations.map((l) => l.name).join(", ") : "All locations";
  const qs = new URLSearchParams({ from: date, to: date, ...(chosen ? { location: chosen } : {}) }).toString();

  return (
    <>
      <form className="filters no-print" method="get">
        <label className="small">Day <input type="date" name="date" defaultValue={date} max={today} /></label>
        {locations.length > 1 && (
          <select name="location" defaultValue={chosen} aria-label="Location">
            <option value="">{isRestricted(user) ? "All my locations" : "All locations"}</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <button className="btn btn-secondary" type="submit">Show</button>
        <PrintButton label="Print" />
        <a className="small" href={`/api/export/daily-stock?${qs}`} download>Stock report (CSV)</a>
        <a className="small" href={`/api/export/sales?${qs}`} download>Sales (CSV)</a>
      </form>
      <h2 style={{ marginBottom: "1rem" }}>{dateLabel} · {where}</h2>

      <section className="stats">
        <div className="stat"><div className="stat-label">Sales</div><div className="stat-value">{formatNumber(t.count)}</div></div>
        <div className="stat"><div className="stat-label">Sales value</div><div className="stat-value">{formatMoney(t.net, { whole: true })}</div></div>
        <div className="stat"><div className="stat-label">Money received</div><div className="stat-value">{formatMoney(t.received, { whole: true })}</div></div>
        <div className={t.creditGiven ? "stat stat-warn" : "stat"}><div className="stat-label">Sold on credit</div><div className="stat-value">{formatMoney(t.creditGiven, { whole: true })}</div></div>
        <div className="stat"><div className="stat-label">Bags sold</div><div className="stat-value">{formatNumber(report.byProduct.reduce((s, p) => s + p.units, 0))}</div></div>
      </section>

      <div className="stack">
        <section className="card">
          <h2>Stock report</h2>
          {report.stock.length === 0 ? <p className="empty">No stock held or moved.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Location</th><th>Product</th><th className="num">Opening</th><th className="num">Delivered</th><th className="num">Transfer in</th>
                    <th className="num">Sold</th><th className="num">Transfer out</th><th className="num">Other</th><th className="num">Closing</th></tr>
                </thead>
                <tbody>
                  {report.stock.map((r) => (
                    <tr key={`${r.locationId}${r.productId}`}>
                      <td className="nowrap">{r.location.code}</td>
                      <td>{r.product.name}</td>
                      <td className="num">{formatNumber(r.opening)}</td>
                      <td className="num">{r.delivered ? formatNumber(r.delivered) : "—"}</td>
                      <td className="num">{r.transferIn ? formatNumber(r.transferIn) : "—"}</td>
                      <td className="num">{r.sold ? formatNumber(r.sold) : "—"}</td>
                      <td className="num">{r.transferOut ? formatNumber(r.transferOut) : "—"}</td>
                      <td className="num">{r.other ? formatNumber(r.other) : "—"}</td>
                      <td className="num"><strong>{formatNumber(r.closing)}</strong> <span className="muted small">{r.product.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">&quot;Other&quot; is stock issued outside a sale and corrections after a count.</p>
        </section>

        <section className="card">
          <h2>Sales by product</h2>
          {report.byProduct.length === 0 ? <p className="empty">No sales on this day.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th className="num">Quantity</th><th className="num">Value</th></tr></thead>
                <tbody>
                  {report.byProduct.map((p) => (
                    <tr key={p.product.id}>
                      <td>{p.product.name} <span className="muted small">{p.product.sku}</span></td>
                      <td className="num">{formatNumber(p.units)} <span className="muted small">{p.product.unit}</span></td>
                      <td className="num nowrap">{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                  {t.discounts > 0 && <tr><td colSpan={2} className="num">Less discounts</td><td className="num nowrap">−{formatMoney(t.discounts)}</td></tr>}
                  <tr><td colSpan={2} className="num"><strong>Total{t.vat > 0 ? ` (incl. VAT ${formatMoney(t.vat)})` : ""}</strong></td><td className="num nowrap"><strong>{formatMoney(t.net)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid-2">
          <section className="card">
            <h2>By sales rep</h2>
            {report.byRep.length === 0 ? <p className="empty">No sales.</p> : (
              <dl className="details">
                {report.byRep.map((r) => <Fragment key={r.label}><dt>{r.label} ({r.count})</dt><dd>{formatMoney(r.total)}</dd></Fragment>)}
              </dl>
            )}
          </section>
          <section className="card">
            <h2>Money received</h2>
            {report.byMethod.length === 0 ? <p className="empty">No payments.</p> : (
              <dl className="details">
                {report.byMethod.map((m) => <Fragment key={m.method}><dt>{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</dt><dd>{formatMoney(m.amountCents)}</dd></Fragment>)}
              </dl>
            )}
            <p className="muted small">Includes payments for earlier credit sales.</p>
          </section>
        </div>
        {!chosen && report.byLocation.length > 1 && (
          <section className="card">
            <h2>By location</h2>
            <dl className="details">
              {report.byLocation.map((r) => <Fragment key={r.label}><dt>{r.label} ({r.count})</dt><dd>{formatMoney(r.total)}</dd></Fragment>)}
            </dl>
          </section>
        )}
      </div>
    </>
  );
}
