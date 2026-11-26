import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closePurchaseOrder, createPurchaseOrder, paySupplier, purchaseOrderValue, receivePurchaseOrder } from "@/lib/purchasing";
import { prisma, qty, resetDb } from "./helpers";

let userId: string, wh: string, oil: string, supplier: string;

beforeEach(async () => {
  await resetDb();
  userId = (await prisma.user.create({ data: { email: "p@t.test", name: "Buyer", passwordHash: "x" } })).id;
  wh = (await prisma.location.create({ data: { code: "WH", name: "Warehouse" } })).id;
  oil = (await prisma.product.create({ data: { sku: "OIL-4L", name: "Engine Oil 4L", costCents: 900_000 } })).id;
  supplier = (await prisma.supplier.create({ data: { name: "Lubricant Distributors Ltd" } })).id;
});

afterAll(() => prisma.$disconnect());

async function order(quantity = 10, unitCostCents = 1_000_000) {
  return createPurchaseOrder(prisma, { supplierId: supplier, locationId: wh, lines: [{ productId: oil, quantity, unitCostCents }] }, userId);
}
async function load(id: string) {
  return prisma.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } });
}

describe("purchase orders", () => {
  it("receives in parts, updates stock and cost, then completes", async () => {
    const po = await order();
    expect(po.number).toBe("PO-000001");
    const [line] = (await load(po.id)).lines;

    await receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 4 }], userId);
    expect((await load(po.id)).status).toBe("PARTIAL");
    expect(await qty(oil, wh)).toBe(4);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: oil } })).costCents).toBe(1_000_000);

    await expect(receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 7 }], userId)).rejects.toThrow("Only 6");
    await receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 6 }], userId);
    expect((await load(po.id)).status).toBe("RECEIVED");
    expect(await qty(oil, wh)).toBe(10);
    await expect(receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 1 }], userId)).rejects.toThrow("received");
  });

  it("values a closed part-delivery at what arrived", async () => {
    const po = await order();
    const [line] = (await load(po.id)).lines;
    await receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 3 }], userId);
    expect(purchaseOrderValue(await load(po.id), (await load(po.id)).lines)).toBe(10_000_000);
    await closePurchaseOrder(prisma, po.id);
    const closed = await load(po.id);
    expect(closed.status).toBe("RECEIVED");
    expect(purchaseOrderValue(closed, closed.lines)).toBe(3_000_000);
  });

  it("allows paying in advance up to the order value", async () => {
    const po = await order(2, 1_000_000);
    await paySupplier(prisma, po.id, { amountCents: 1_500_000, method: "TRANSFER" }, userId);
    await expect(paySupplier(prisma, po.id, { amountCents: 600_000, method: "TRANSFER" }, userId)).rejects.toThrow("₦5,000.00 outstanding");
    await paySupplier(prisma, po.id, { amountCents: 500_000, method: "CASH" }, userId);
    await expect(paySupplier(prisma, po.id, { amountCents: 1, method: "CASH" }, userId)).rejects.toThrow("fully paid");
    await expect(closePurchaseOrder(prisma, po.id)).rejects.toThrow("can't be cancelled");
  });

  it("cancels an order with nothing received", async () => {
    const po = await order();
    await closePurchaseOrder(prisma, po.id);
    const cancelled = await load(po.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(purchaseOrderValue(cancelled, cancelled.lines)).toBe(0);
  });
});
