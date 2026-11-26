import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { customerBalances, supplierBalances } from "./balances";

type Range = Prisma.DateTimeFilter | undefined;

/** locationIds limits to those locations (empty = whole company). */
export async function salesSummary(createdAt: Range, locationIds: string[] = []) {
  const loc = locationIds.length ? { locationId: { in: locationIds } } : {};
  const lines = await prisma.saleLine.findMany({
    where: { sale: { status: "COMPLETED", ...loc, ...(createdAt ? { createdAt } : {}) } },
    include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
  });
  const byProduct = new Map<string, { product: (typeof lines)[number]["product"]; quantity: number; revenue: number; cost: number }>();
  for (const l of lines) {
    const row = byProduct.get(l.productId) ?? { product: l.product, quantity: 0, revenue: 0, cost: 0 };
    row.quantity += l.quantity * l.unitsPerPack;
    row.revenue += l.quantity * l.unitPriceCents;
    row.cost += l.quantity * l.unitCostCents;
    byProduct.set(l.productId, row);
  }
  const products = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue);
  const revenue = products.reduce((s, p) => s + p.revenue, 0);
  const cost = products.reduce((s, p) => s + p.cost, 0);

  const [saleCount, payments] = await Promise.all([
    prisma.sale.count({ where: { status: "COMPLETED", kind: "SALE", ...loc, ...(createdAt ? { createdAt } : {}) } }),
    prisma.payment.groupBy({ by: ["method"], where: { ...(createdAt ? { paidAt: createdAt } : {}), ...(locationIds.length ? { sale: loc } : {}) }, _sum: { amountCents: true } }),
  ]);
  return {
    saleCount, revenue, cost, profit: revenue - cost, products,
    payments: payments.map((p) => ({ method: p.method, amountCents: p._sum.amountCents ?? 0 })).filter((p) => p.amountCents !== 0),
  };
}

export async function stockValuation(locationIds: string[] = []) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      stock: {
        where: { location: { active: true }, ...(locationIds.length ? { locationId: { in: locationIds } } : {}) },
        include: { location: { select: { code: true } } },
      },
    },
  });
  return products.map((p) => {
    const quantity = p.stock.reduce((s, x) => s + x.quantity, 0);
    return {
      product: p,
      quantity,
      byLocation: p.stock.filter((s) => s.quantity !== 0).map((s) => `${s.location.code}: ${s.quantity}`).join(", "),
      costValue: quantity * p.costCents,
      retailValue: quantity * p.priceRetailCents,
    };
  });
}

export async function debtors() {
  const balances = await customerBalances();
  const owing = [...balances.entries()].filter(([, b]) => b > 0);
  const customers = await prisma.customer.findMany({ where: { id: { in: owing.map(([id]) => id) } } });
  const byId = new Map(customers.map((c) => [c.id, c]));
  return owing.map(([id, balance]) => ({ customer: byId.get(id)!, balance })).sort((a, b) => b.balance - a.balance);
}

export async function creditors() {
  const balances = await supplierBalances();
  const owed = [...balances.entries()].filter(([, b]) => b > 0);
  const suppliers = await prisma.supplier.findMany({ where: { id: { in: owed.map(([id]) => id) } } });
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  return owed.map(([id, balance]) => ({ supplier: byId.get(id)!, balance })).sort((a, b) => b.balance - a.balance);
}
