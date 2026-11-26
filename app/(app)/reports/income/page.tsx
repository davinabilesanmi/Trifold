import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { incomeStatement } from "@/lib/financials";
import { monthRange } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { LetterheadFooter, LetterheadHeader } from "@/components/Letterhead";

export const metadata = { title: "Income statement" };

function Row({ label, value, strong, indent, negative }: { label: string; value: number; strong?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <tr className={strong ? "fs-total" : undefined}>
      <td style={indent ? { paddingLeft: "2rem" } : undefined}>{label}</td>
      <td className={`num nowrap ${value < 0 ? "neg" : ""}`}>{negative ? `(${formatMoney(value)})` : formatMoney(value)}</td>
    </tr>
  );
}

export default async function IncomeStatementPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission(can.viewFinancials);
  const { month: m } = await searchParams;
  const { month, start, end, label } = monthRange(m);
  const [is, settings] = await Promise.all([incomeStatement(start, end), getSettings()]);
  const margin = is.revenue ? Math.round((is.netProfit / is.revenue) * 1000) / 10 : 0;

  return (
    <>
      <form className="filters no-print" method="get">
        <label className="small">Month <input type="month" name="month" defaultValue={month} /></label>
        <button className="btn btn-secondary" type="submit">Show</button>
        <PrintButton label="Print" />
      </form>
      <article className="card fs">
        <LetterheadHeader settings={settings} />
        <header className="fs-head">
          <h2>Income statement for {label}</h2>
        </header>
        <table className="table fs-table">
          <tbody>
            <Row label={`Sales (${is.saleCount} invoices)`} value={is.grossSales} />
            {is.discounts > 0 && <Row label="Less: discounts given" value={is.discounts} negative indent />}
            {is.vat > 0 && <Row label="Less: VAT collected (owed to FIRS)" value={is.vat} negative indent />}
            <Row label="Revenue" value={is.revenue} strong />
            <Row label="Less: cost of cement sold" value={is.costOfSales} negative />
            <Row label="Gross profit" value={is.grossProfit} strong />
            <tr><td colSpan={2} className="muted small">Rebates from manufacturers</td></tr>
            {is.rebates.length === 0 && <tr><td colSpan={2} className="muted small" style={{ paddingLeft: "2rem" }}>None recorded</td></tr>}
            {is.rebates.map((r) => <Row key={r.category} label={r.category} value={r.amountCents} indent />)}
            {is.rebates.length > 0 && <Row label="Gross profit after rebates" value={is.grossProfit + is.totalRebates} strong />}
            <tr><td colSpan={2} className="muted small">Operating expenses</td></tr>
            {is.expenses.length === 0 && <tr><td colSpan={2} className="muted small" style={{ paddingLeft: "2rem" }}>None recorded</td></tr>}
            {is.expenses.map((e) => <Row key={e.category} label={e.category} value={e.amountCents} negative indent />)}
            <Row label="Total operating expenses" value={is.totalExpenses} negative />
            {is.otherIncome.map((e) => <Row key={e.category} label={`Other income: ${e.category}`} value={e.amountCents} />)}
            <Row label={is.netProfit >= 0 ? `Net profit (${margin}% of revenue)` : "Net loss"} value={is.netProfit} strong />
          </tbody>
        </table>
        <p className="muted small">
          Management accounts prepared from sales, purchase costs, rebates and expenses recorded in the system. Prices and costs include
          the VAT charged by Lafarge and Dangote, which Trifold doesn&apos;t file itself. Cost of cement sold uses each product&apos;s
          purchase cost at the time of sale. Owner capital and drawings aren&apos;t income or expenses and appear on the balance sheet
          instead. Have your accountant review before filing.
        </p>
        <LetterheadFooter settings={settings} />
      </article>
    </>
  );
}
