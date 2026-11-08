import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { supplierBalances } from "@/lib/balances";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ArchivedBadge } from "@/components/Badges";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const { archived } = await searchParams;
  const suppliers = await prisma.supplier.findMany({ where: archived ? {} : { active: true }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  const balances = await supplierBalances(suppliers.map((s) => s.id));
  const owed = [...balances.values()].reduce((s, b) => s + Math.max(0, b), 0);
  return (
    <>
      <PageHeader title="Suppliers" subtitle={<>{suppliers.length} suppliers · Trifold owes {formatMoney(owed)}</>}
        actions={can.managePurchasing(user.role) && <Link href="/suppliers/new" className="btn btn-primary">Add supplier</Link>} />
      <form className="filters" method="get">
        <label className="checkbox small"><input type="checkbox" name="archived" value="1" defaultChecked={!!archived} /> Include archived</label>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      {suppliers.length === 0 ? <p className="empty">No suppliers yet.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th className="num">Trifold owes</th></tr></thead>
            <tbody>
              {suppliers.map((s) => {
                const b = balances.get(s.id) ?? 0;
                return (
                  <tr key={s.id} className={s.active ? undefined : "row-archived"}>
                    <td><Link href={`/suppliers/${s.id}`}>{s.name}</Link> {!s.active && <ArchivedBadge />}</td>
                    <td>{s.contactName}</td>
                    <td className="nowrap">{s.phone}</td>
                    <td className={`num nowrap ${b > 0 ? "neg" : ""}`}>{b > 0 ? formatMoney(b) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
