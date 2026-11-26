import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { customerBalances } from "@/lib/balances";
import { PRICE_LEVEL_LABELS, isPriceLevel } from "@/lib/money";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ArchivedBadge } from "@/components/Badges";

export const metadata = { title: "Customers" };

type Search = { q?: string; owing?: string; archived?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePermission((u) => can.sell(u) || can.manageCustomers(u) || can.takePayments(u));
  const { q = "", owing, archived } = await searchParams;
  const term = q.trim();
  const where: Prisma.CustomerWhereInput = {
    ...(archived ? {} : { active: true }),
    ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { phone: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] } : {}),
  };
  const customers = await prisma.customer.findMany({ where, orderBy: [{ active: "desc" }, { name: "asc" }] });
  const balances = await customerBalances(customers.map((c) => c.id));
  const rows = customers
    .map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 }))
    .filter((c) => !owing || c.balance > 0);
  const totalOwed = rows.reduce((s, c) => s + Math.max(0, c.balance), 0);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={<>{rows.length} shown · {formatMoney(totalOwed)} owed to Trifold</>}
        actions={can.manageCustomers(user) && <Link href="/customers/new" className="btn btn-primary">Add customer</Link>}
      />
      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Search name, phone or email" defaultValue={q} aria-label="Search" />
        <label className="checkbox small"><input type="checkbox" name="owing" value="1" defaultChecked={!!owing} /> Owing money only</label>
        <label className="checkbox small"><input type="checkbox" name="archived" value="1" defaultChecked={!!archived} /> Include archived</label>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      {rows.length === 0 ? (
        <p className="empty">No customers found.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Customer</th><th>Type</th><th>Phone</th><th className="num">Owes</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.active ? undefined : "row-archived"}>
                  <td><Link href={`/customers/${c.id}`}>{c.name}</Link> {!c.active && <ArchivedBadge />}</td>
                  <td>{isPriceLevel(c.type) ? PRICE_LEVEL_LABELS[c.type] : c.type}</td>
                  <td className="nowrap">{c.phone}</td>
                  <td className={`num nowrap ${c.balance > 0 ? "neg" : ""}`}>{c.balance > 0 ? formatMoney(c.balance) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
