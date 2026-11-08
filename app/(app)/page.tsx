import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { productsWithTotals } from "@/lib/queries";
import { customerBalances, supplierBalances } from "@/lib/balances";
import { startOfDay, todayInLagos } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/Badges";
import { SalesTable, saleRowInclude } from "@/components/SalesTable";

export const metadata = { title: "Dashboard" };

const sum = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + Math.max(0, v), 0);

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const manager = can.viewReports(user.role);
  const todayStart = startOfDay(todayInLagos());

  const [products, todaySales, recentSales, openOrders, receivable, payable] = await Promise.all([
    productsWithTotals({ active: true }),
    prisma.sale.aggregate({ where: { status: "COMPLETED", createdAt: { gte: todayStart } }, _sum: { totalCents: true }, _count: true }),
    prisma.sale.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: saleRowInclude }),
    prisma.purchaseOrder.count({ where: { status: { in: ["ORDERED", "PARTIAL"] } } }),
    manager ? customerBalances().then(sum) : Promise.resolve(0),
    manager ? supplierBalances().then(sum) : Promise.resolve(0),
  ]);

  const stockValue = products.reduce((s, p) => s + p.onHand * p.costCents, 0);
  const attention = products.filter((p) => p.status !== "OK");

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        subtitle="Today at Trifold."
        actions={<>
          <Link href="/sales/new" className="btn btn-primary">New sale</Link>
          <Link href="/movements/new" className="btn btn-secondary">Record movement</Link>
        </>}
      />
      {denied && <p className="alert alert-warn page-alert">You don&apos;t have permission to open that page.</p>}

      <section className="stats">
        <Link href={`/sales?from=${todayInLagos()}`} className="stat stat-link">
          <div className="stat-label">Sales today ({todaySales._count})</div>
          <div className="stat-value">{formatMoney(todaySales._sum.totalCents ?? 0, { whole: true })}</div>
        </Link>
        {manager && (
          <>
            <Link href="/customers?owing=1" className={receivable ? "stat stat-link stat-warn" : "stat stat-link"}>
              <div className="stat-label">Customers owe</div><div className="stat-value">{formatMoney(receivable, { whole: true })}</div>
            </Link>
            <Link href="/suppliers" className="stat stat-link">
              <div className="stat-label">Trifold owes suppliers</div><div className="stat-value">{formatMoney(payable, { whole: true })}</div>
            </Link>
            <div className="stat"><div className="stat-label">Stock value (at cost)</div><div className="stat-value">{formatMoney(stockValue, { whole: true })}</div></div>
          </>
        )}
        <Link href="/products?status=attention" className={attention.length ? "stat stat-link stat-warn" : "stat stat-link"}>
          <div className="stat-label">Need reordering</div><div className="stat-value">{formatNumber(attention.length)}</div>
        </Link>
        <Link href="/purchases" className="stat stat-link">
          <div className="stat-label">Deliveries expected</div><div className="stat-value">{formatNumber(openOrders)}</div>
        </Link>
      </section>

      <div className="stack">
        <section className="card">
          <div className="section-head">
            <h2>Recent sales</h2>
            <Link href="/sales" className="small">View all</Link>
          </div>
          <SalesTable sales={recentSales} />
        </section>

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
      </div>
    </>
  );
}
