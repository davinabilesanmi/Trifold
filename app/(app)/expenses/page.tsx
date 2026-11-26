import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, EXPENSE_KINDS, EXPENSE_KIND_LABELS, MONEY_IN, isExpenseKind } from "@/lib/expenses";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/money";
import { monthRange, todayInLagos } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { locationWhere } from "@/lib/scope";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requirePermission((u) => can.manageExpenses(u) || can.viewFinancials(u));
  const { month: m } = await searchParams;
  const { month, start, end, label } = monthRange(m);
  const [entries, locations] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: start, lt: end } }, orderBy: { date: "desc" },
      include: { user: { select: { name: true } }, location: { select: { code: true } } },
    }),
    prisma.location.findMany({ where: { active: true, ...locationWhere(user) }, orderBy: { name: "asc" } }),
  ]);
  const totalOf = (k: string) => entries.filter((e) => e.kind === k).reduce((s, e) => s + e.amountCents, 0);
  const manage = can.manageExpenses(user);

  return (
    <>
      <PageHeader title="Expenses and other money" subtitle={`${label}: ${formatMoney(totalOf("EXPENSE"))} spent on running costs`} />
      <form className="filters" method="get">
        <label className="small">Month <input type="month" name="month" defaultValue={month} /></label>
        <button className="btn btn-secondary" type="submit">Show</button>
      </form>
      <div className={manage ? "grid-2" : undefined}>
        <section className="card">
          <h2>Entries for {label}</h2>
          {entries.length === 0 ? <p className="empty">Nothing recorded this month.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Category</th><th>Type</th><th className="num">Amount</th>{manage && <th aria-label="Delete" />}</tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="nowrap">{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(e.date)}</td>
                      <td>
                        {e.category}{e.location && <span className="muted small"> · {e.location.code}</span>}
                        {(e.note || e.reference) && <div className="muted small">{[e.reference, e.note].filter(Boolean).join(" · ")}</div>}
                      </td>
                      <td className="small">{isExpenseKind(e.kind) ? EXPENSE_KIND_LABELS[e.kind] : e.kind}</td>
                      <td className={`num nowrap ${isExpenseKind(e.kind) && MONEY_IN[e.kind] ? "pos" : ""}`}>{formatMoney(e.amountCents)}</td>
                      {manage && (
                        <td>
                          <form action={deleteExpense.bind(null, e.id)}><button type="submit" className="btn-link small">Delete</button></form>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <dl className="details" style={{ marginTop: "1rem" }}>
            {EXPENSE_KINDS.filter((k) => totalOf(k) > 0).map((k) => (
              <Fragment key={k}><dt>{EXPENSE_KIND_LABELS[k]}</dt><dd>{formatMoney(totalOf(k))}</dd></Fragment>
            ))}
          </dl>
          {can.viewFinancials(user) && <p className="small"><Link href={`/reports/income?month=${month}`}>See the income statement for {label}</Link></p>}
        </section>
        {manage && (
          <section className="card">
            <h2>Record an entry</h2>
            <ActionForm action={createExpense} resetOnSuccess>
              <div className="field">
                <label htmlFor="kind">Type</label>
                <select id="kind" name="kind" defaultValue="EXPENSE">
                  {EXPENSE_KINDS.map((k) => <option key={k} value={k}>{EXPENSE_KIND_LABELS[k]}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="category">Category</label>
                  <input id="category" name="category" list="expense-categories" required maxLength={60} placeholder="e.g. Haulage and transport" />
                  <datalist id="expense-categories">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="field">
                  <label htmlFor="amount">Amount (₦)</label>
                  <input id="amount" name="amount" type="text" inputMode="decimal" required placeholder="0.00" />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="date">Date</label>
                  <input id="date" name="date" type="date" required defaultValue={todayInLagos()} max={todayInLagos()} />
                </div>
                <div className="field">
                  <label htmlFor="method">Paid by</label>
                  <select id="method" name="method" defaultValue="TRANSFER">
                    {PAYMENT_METHODS.map((pm) => <option key={pm} value={pm}>{PAYMENT_METHOD_LABELS[pm]}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="locationId">Location (optional)</label>
                  <select id="locationId" name="locationId" defaultValue="">
                    <option value="">Whole company</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="reference">Reference</label>
                  <input id="reference" name="reference" type="text" maxLength={100} placeholder="Receipt or transfer ref" />
                </div>
              </div>
              <div className="field"><label htmlFor="note">Note</label><input id="note" name="note" type="text" maxLength={300} /></div>
              <div className="form-actions"><SubmitButton>Save entry</SubmitButton></div>
            </ActionForm>
            <p className="muted small">
              Expenses and other income appear in the income statement. Owner capital, drawings and VAT paid to FIRS only affect cash and the balance sheet.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
