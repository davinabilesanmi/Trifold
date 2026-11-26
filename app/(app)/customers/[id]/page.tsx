import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { customerBalances } from "@/lib/balances";
import { saleWhere } from "@/lib/scope";
import { customerOpeningBalanceAction, setCustomerActive, updateCustomer } from "@/lib/actions/parties";
import { OpeningBalanceForm } from "@/components/OpeningBalanceForm";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { CustomerFields } from "@/components/PartyFields";
import { ArchivedBadge } from "@/components/Badges";
import { SalesTable, saleRowInclude } from "@/components/SalesTable";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();
  const [sales, balances] = await Promise.all([
    prisma.sale.findMany({ where: { customerId: id, ...saleWhere(user) }, orderBy: { createdAt: "desc" }, take: 50, include: saleRowInclude }),
    customerBalances([id]),
  ]);
  const balance = balances.get(id) ?? 0;
  const hasOpening = sales.some((s) => s.kind === "OPENING_BALANCE" && s.status === "COMPLETED");

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={<>{customer.type === "WHOLESALE" ? "Wholesale" : "Retail"} customer {!customer.active && <ArchivedBadge />}</>}
        actions={customer.active && can.sell(user) && (
          <Link href={`/sales/new?customer=${customer.id}`} className="btn btn-primary">New sale</Link>
        )}
      />
      <section className="stats">
        <div className={balance > 0 ? "stat stat-warn" : "stat"}>
          <div className="stat-label">Owes Trifold</div>
          <div className="stat-value">{formatMoney(Math.max(0, balance))}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total bought</div>
          <div className="stat-value">{formatMoney(sales.filter((s) => s.status === "COMPLETED" && s.kind === "SALE").reduce((s, x) => s + x.totalCents, 0))}</div>
        </div>
      </section>
      <div className="grid-2">
        <section className="card">
          <h2>Sales</h2>
          {balance > 0 && <p className="muted small">Open an unpaid invoice to record a payment against it.</p>}
          <SalesTable sales={sales} showCustomer={false} />
        </section>
        <div>
        {customer.active && !hasOpening && can.openingBalances(user) && (
          <OpeningBalanceForm who="customer" action={customerOpeningBalanceAction.bind(null, customer.id)} />
        )}
        {can.manageCustomers(user) && <section className="card">
          <h2>Details</h2>
          <ActionForm action={updateCustomer.bind(null, customer.id)}>
            <CustomerFields customer={customer} />
            <div className="form-actions"><SubmitButton>Save changes</SubmitButton></div>
          </ActionForm>
          <form action={setCustomerActive.bind(null, customer.id, !customer.active)} style={{ marginTop: "1rem" }}>
            <button type="submit" className={customer.active ? "btn btn-danger" : "btn btn-secondary"}>
              {customer.active ? "Archive customer" : "Restore customer"}
            </button>
          </form>
        </section>}
        </div>
      </div>
    </>
  );
}
