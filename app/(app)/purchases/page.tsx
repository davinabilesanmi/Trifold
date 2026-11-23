import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseOrdersTable, poBalance, purchaseOrderRowInclude } from "@/components/PurchaseOrdersTable";

export const metadata = { title: "Purchase orders" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePermission((u) => can.managePurchasing(u) || can.receivePurchases(u));
  const { status = "open" } = await searchParams;
  const where = status === "open" ? { status: { in: ["ORDERED", "PARTIAL"] } } : status === "all" ? {} : { status: status.toUpperCase() };
  const orders = await prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: purchaseOrderRowInclude });
  const unpaid = orders.reduce((s, o) => s + Math.max(0, poBalance(o)), 0);
  return (
    <>
      <PageHeader title="Purchase orders" subtitle={`${orders.length} shown · ${formatMoney(unpaid)} unpaid`}
        actions={can.managePurchasing(user) && <Link href="/purchases/new" className="btn btn-primary">New purchase order</Link>} />
      <nav className="tabs" aria-label="Status">
        {[["open", "Awaiting delivery"], ["received", "Received"], ["cancelled", "Cancelled"], ["all", "All"]].map(([key, label]) => (
          <Link key={key} href={`/purchases?status=${key}`} className={status === key ? "tab active" : "tab"}>{label}</Link>
        ))}
      </nav>
      <PurchaseOrdersTable orders={orders} />
    </>
  );
}
