import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { balanceSheet } from "@/lib/financials";
import { monthRange, startOfDay, todayInLagos } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Balance sheet" };

function Row({ label, value, strong, indent }: { label: string; value: number; strong?: boolean; indent?: boolean }) {
  return (
    <tr className={strong ? "fs-total" : undefined}>
      <td style={indent ? { paddingLeft: "2rem" } : undefined}>{label}</td>
      <td className={`num nowrap ${value < 0 ? "neg" : ""}`}>{formatMoney(value)}</td>
    </tr>
  );
}

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePermission(can.viewFinancials);
  const { month: m } = await searchParams;
  const { month, end, label } = monthRange(m);
  // A month still in progress is shown as at now.
  const now = new Date();
  const asOf = end > now ? now : end;
  const settings = await getSettings();
  const bs = await balanceSheet(asOf, settings.openingCash);
  const today = todayInLagos();
  const asOfLabel = end > now
    ? `today, ${new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(startOfDay(today))}`
    : `the end of ${label}`;

  return (
    <>
      <form className="filters no-print" method="get">
        <label className="small">Month end <input type="month" name="month" defaultValue={month} /></label>
        <button className="btn btn-secondary" type="submit">Show</button>
        <PrintButton label="Print" />
      </form>
      <article className="card fs">
        <header className="fs-head">
          <div className="invoice-business">{settings.businessName}</div>
          <h2>Balance sheet as at {asOfLabel}</h2>
        </header>
        <table className="table fs-table">
          <tbody>
            <tr><td colSpan={2}><strong>What the business owns</strong></td></tr>
            <Row label="Cash and bank" value={bs.cash} indent />
            <Row label="Cement in stock (at cost)" value={bs.inventory} indent />
            <Row label="Customers owe Trifold" value={bs.receivables} indent />
            {bs.supplierAdvances > 0 && <Row label="Advances paid to suppliers" value={bs.supplierAdvances} indent />}
            <Row label="Total assets" value={bs.totalAssets} strong />
            <tr><td colSpan={2}><strong>What the business owes</strong></td></tr>
            <Row label="Owed to suppliers" value={bs.payables} indent />
            <Row label="VAT owed to FIRS" value={bs.vatPayable} indent />
            {bs.customerCredits > 0 && <Row label="Customer credit balances" value={bs.customerCredits} indent />}
            <Row label="Total liabilities" value={bs.totalLiabilities} strong />
            <Row label="Net assets (owner's equity)" value={bs.equity} strong />
            <tr><td colSpan={2} className="muted small">Made up of</td></tr>
            <Row label="Position when the system started (opening cash, stock and balances)" value={bs.openingPosition} indent />
            <Row label="Capital put in less drawings" value={bs.capital} indent />
            <Row label="Profit earned since the system started" value={bs.profitToDate} indent />
          </tbody>
        </table>
        <p className="muted small">
          Management balance sheet built from what is recorded in the system: the opening cash in Settings, payments received and made,
          expenses, stock (valued at current cost) and money owed both ways. Fixed assets such as trucks, buildings and loans aren&apos;t
          tracked yet. Have your accountant review before filing.
        </p>
      </article>
    </>
  );
}
