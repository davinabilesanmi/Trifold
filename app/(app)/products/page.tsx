import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { productsWithTotals } from "@/lib/queries";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ArchivedBadge, StatusBadge } from "@/components/Badges";

export const metadata = { title: "Products" };

type Search = { q?: string; status?: string; archived?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { q = "", status = "", archived } = await searchParams;
  const term = q.trim();

  const where: Prisma.ProductWhereInput = {
    ...(archived ? {} : { active: true }),
    ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } }, { category: { contains: term, mode: "insensitive" } }] } : {}),
  };
  let products = await productsWithTotals(where);
  if (status === "attention") products = products.filter((p) => p.status !== "OK");
  if (status === "out") products = products.filter((p) => p.status === "OUT");

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${formatNumber(products.length)} shown`}
        actions={can.manageCatalog(user) && <Link href="/products/new" className="btn btn-primary">Add product</Link>}
      />
      <form className="filters" method="get">
        <input type="search" name="q" placeholder="Search name, SKU or category" defaultValue={q} aria-label="Search" />
        <select name="status" defaultValue={status} aria-label="Stock status">
          <option value="">All stock levels</option>
          <option value="attention">Low or out of stock</option>
          <option value="out">Out of stock</option>
        </select>
        <label className="checkbox small"><input type="checkbox" name="archived" value="1" defaultChecked={!!archived} /> Include archived</label>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>

      {products.length === 0 ? (
        <p className="empty">No products match. {can.manageCatalog(user) && <Link href="/products/new">Add one</Link>}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Category</th><th className="num">On hand</th><th className="num">Retail</th><th className="num">Wholesale</th><th>Status</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.active ? undefined : "row-archived"}>
                  <td><Link href={`/products/${p.id}`}>{p.name}</Link></td>
                  <td className="nowrap">{p.sku}</td>
                  <td>{p.category}</td>
                  <td className="num nowrap">{formatNumber(p.onHand)} <span className="muted small">{p.unit}</span></td>
                  <td className="num nowrap">{formatMoney(p.priceRetailCents)}</td>
                  <td className="num nowrap">{formatMoney(p.priceWholesaleCents)}</td>
                  <td>{p.active ? <StatusBadge status={p.status} /> : <ArchivedBadge />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
