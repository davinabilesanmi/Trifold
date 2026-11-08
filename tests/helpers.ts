import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve(__dirname, "../prisma/test.db")}?connection_limit=1` } },
});

/** Empties every table, children first. */
export async function resetDb() {
  await prisma.payment.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.saleLine.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.location.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

export async function qty(productId: string, locationId: string) {
  const level = await prisma.stockLevel.findUnique({ where: { productId_locationId: { productId, locationId } } });
  return level?.quantity ?? 0;
}
