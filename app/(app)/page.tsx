import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { productsWithTotals } from "@/lib/queries";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { MovementTable, movementRowInclude } from "@/components/MovementTable";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const [products, locationCount, recent] = await Promise.all([
    productsWithTotals({ active: true }),
    prisma.location.count({ where: { active: true } }),
    prisma.movement.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: movementRowInclude }),
  ]);

  const totalUnits = products.reduce((s, p) => s + p.onHand, 0);
  const stockValue = products.reduce((s, p) => s + p.onHand * p.costCents, 0);
  const attention = products.filter((p) => p.status !== "OK");

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Overview of stock across all Trifold locations."
        actions={<Link href="/movements/new" className="btn btn-primary">Record movement</Link>}
      />
      {denied && <p className="alert alert-warn page-alert">You don&apos;t have permission to open that page.</p>}

      <section className="stats">
        <div className="stat"><div className="stat-label">Active products</div><div className="stat-value">{formatNumber(products.length)}</div></div>
        <div className="stat"><div className="stat-label">Locations</div><div className="stat-value">{formatNumber(locationCount)}</div></div>
        <div className="stat"><div className="stat-label">Units on hand</div><div className="stat-value">{formatNumber(totalUnits)}</div></div>
        <div className="stat"><div className="stat-label">Stock value (at cost)</div><div className="stat-value">{formatMoney(stockValue)}</div></div>
        <div className={attention.length ? "stat stat-warn" : "stat"}>
          <div className="stat-label">Need reordering</div><div className="stat-value">{formatNumber(attention.length)}</div>
        </div>
      </section>

      <div className="stack">
        <section className="card">
          <div className="section-head">
            <h2>Low and out of stock</h2>
            <Link href="/products?status=attention" className="small">View all</Link>
          </div>
          {attention.length === 0 ? (
            <p className="empty">Everything is above its reorder level.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Product</th><th>SKU</th><th className="num">On hand</th><th className="num">Reorder at</th><th>Status</th></tr></thead>
                <tbody>
                  {attention.slice(0, 10).map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/products/${p.id}`}>{p.name}</Link></td>
                      <td>{p.sku}</td>
                      <td className="num">{formatNumber(p.onHand)} <span className="muted small">{p.unit}</span></td>
                      <td className="num">{formatNumber(p.reorderLevel)}</td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h2>Recent movements</h2>
            <Link href="/movements" className="small">View all</Link>
          </div>
          <MovementTable movements={recent} />
        </section>
      </div>
    </>
  );
}
