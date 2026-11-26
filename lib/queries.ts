import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { stockStatus } from "./stock";

/** Products with their on-hand total across active locations. */
export async function productsWithTotals(where: Prisma.ProductWhereInput = {}) {
  const products = await prisma.product.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { stock: { where: { location: { active: true } }, select: { quantity: true } } },
  });
  return products.map(({ stock, ...p }) => {
    const onHand = stock.reduce((sum, s) => sum + s.quantity, 0);
    return { ...p, onHand, status: stockStatus(onHand, p.reorderLevel) };
  });
}

export async function activeOptions() {
  const [products, locations] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, sku: true, name: true, unit: true } }),
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return { products, locations };
}
