import "server-only";
import { prisma } from "./db";
import { purchaseOrderValue } from "./purchasing";

/** Amount each customer owes across completed sales (positive = owes Trifold). */
export async function customerBalances(customerIds?: string[]) {
  const where = { status: "COMPLETED", customerId: customerIds ? { in: customerIds } : { not: null } };
  const [sales, payments] = await Promise.all([
    prisma.sale.groupBy({ by: ["customerId"], where, _sum: { totalCents: true } }),
    prisma.payment.findMany({ where: { sale: where }, select: { amountCents: true, sale: { select: { customerId: true } } } }),
  ]);
  const balances = new Map<string, number>();
  for (const s of sales) if (s.customerId) balances.set(s.customerId, s._sum.totalCents ?? 0);
  for (const p of payments) {
    const id = p.sale.customerId!;
    balances.set(id, (balances.get(id) ?? 0) - p.amountCents);
  }
  return balances;
}

/** Amount Trifold owes each supplier (positive = Trifold owes them). */
export async function supplierBalances(supplierIds?: string[]) {
  const orders = await prisma.purchaseOrder.findMany({
    where: { status: { not: "CANCELLED" }, ...(supplierIds ? { supplierId: { in: supplierIds } } : {}) },
    include: { lines: true, payments: { select: { amountCents: true } } },
  });
  const balances = new Map<string, number>();
  for (const po of orders) {
    const owed = purchaseOrderValue(po, po.lines) - po.payments.reduce((s, p) => s + p.amountCents, 0);
    balances.set(po.supplierId, (balances.get(po.supplierId) ?? 0) + owed);
  }
  return balances;
}

export function saleBalance(sale: { status: string; totalCents: number; payments: { amountCents: number }[] }) {
  if (sale.status !== "COMPLETED") return 0;
  return sale.totalCents - sale.payments.reduce((s, p) => s + p.amountCents, 0);
}
