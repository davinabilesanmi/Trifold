import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { recordMovement, StockError, stockStatus } from "@/lib/stock";
import { prisma, resetDb } from "./helpers";

let userId: string;
let productId: string;
let a: string;
let b: string;

async function qty(locationId: string) {
  const level = await prisma.stockLevel.findUnique({ where: { productId_locationId: { productId, locationId } } });
  return level?.quantity ?? 0;
}

beforeEach(async () => {
  await resetDb();
  userId = (await prisma.user.create({ data: { email: "t@t.test", name: "Tester", passwordHash: "x" } })).id;
  productId = (await prisma.product.create({ data: { sku: "SKU-1", name: "Widget" } })).id;
  a = (await prisma.location.create({ data: { code: "A", name: "Alpha" } })).id;
  b = (await prisma.location.create({ data: { code: "B", name: "Beta" } })).id;
});

afterAll(() => prisma.$disconnect());

describe("recordMovement", () => {
  it("receives stock into a location", async () => {
    await recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 10 }, userId);
    await recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 5, reference: " PO-1 " }, userId);
    expect(await qty(a)).toBe(15);
    const last = await prisma.movement.findFirstOrThrow({ orderBy: { createdAt: "desc" }, where: { quantity: 5 } });
    expect(last.reference).toBe("PO-1");
  });

  it("issues stock and refuses to go negative", async () => {
    await recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 10 }, userId);
    await recordMovement(prisma, { type: "ISSUE", productId, fromLocationId: a, quantity: 4 }, userId);
    expect(await qty(a)).toBe(6);
    await expect(
      recordMovement(prisma, { type: "ISSUE", productId, fromLocationId: a, quantity: 7 }, userId),
    ).rejects.toThrow("Not enough stock at Alpha: 6 available, 7 requested.");
    expect(await qty(a)).toBe(6);
    expect(await prisma.movement.count()).toBe(2);
  });

  it("refuses to issue from a location with no stock record", async () => {
    await expect(
      recordMovement(prisma, { type: "ISSUE", productId, fromLocationId: b, quantity: 1 }, userId),
    ).rejects.toBeInstanceOf(StockError);
  });

  it("transfers between locations atomically", async () => {
    await recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 10 }, userId);
    await recordMovement(prisma, { type: "TRANSFER", productId, fromLocationId: a, toLocationId: b, quantity: 3 }, userId);
    expect([await qty(a), await qty(b)]).toEqual([7, 3]);

    await expect(
      recordMovement(prisma, { type: "TRANSFER", productId, fromLocationId: a, toLocationId: b, quantity: 8 }, userId),
    ).rejects.toThrow(StockError);
    expect([await qty(a), await qty(b)]).toEqual([7, 3]);

    await expect(
      recordMovement(prisma, { type: "TRANSFER", productId, fromLocationId: a, toLocationId: a, quantity: 1 }, userId),
    ).rejects.toThrow("different locations");
  });

  it("adjusts to a counted quantity and records the signed difference", async () => {
    await recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 10 }, userId);
    const down = await recordMovement(prisma, { type: "ADJUSTMENT", productId, locationId: a, countedQuantity: 7 }, userId);
    expect(down.quantity).toBe(-3);
    expect(await qty(a)).toBe(7);
    const up = await recordMovement(prisma, { type: "ADJUSTMENT", productId, locationId: b, countedQuantity: 2 }, userId);
    expect(up.quantity).toBe(2);
    expect(await qty(b)).toBe(2);
    await expect(
      recordMovement(prisma, { type: "ADJUSTMENT", productId, locationId: a, countedQuantity: 7 }, userId),
    ).rejects.toThrow("nothing to adjust");
  });

  it("rejects invalid quantities and archived records", async () => {
    await expect(
      recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 0 }, userId),
    ).rejects.toThrow(StockError);
    await expect(
      recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 1.5 }, userId),
    ).rejects.toThrow(StockError);

    await prisma.location.update({ where: { id: b }, data: { active: false } });
    await expect(
      recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: b, quantity: 1 }, userId),
    ).rejects.toThrow("Beta is archived.");

    await prisma.product.update({ where: { id: productId }, data: { active: false } });
    await expect(
      recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 1 }, userId),
    ).rejects.toThrow("Widget is archived.");
  });

  it("does not oversell under concurrent issues", { timeout: 20_000 }, async () => {
    await recordMovement(prisma, { type: "RECEIPT", productId, toLocationId: a, quantity: 5 }, userId);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => recordMovement(prisma, { type: "ISSUE", productId, fromLocationId: a, quantity: 1 }, userId)),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(5);
    expect(await qty(a)).toBe(0);
  });
});

describe("stockStatus", () => {
  it("classifies stock levels", () => {
    expect(stockStatus(0, 10)).toBe("OUT");
    expect(stockStatus(10, 10)).toBe("LOW");
    expect(stockStatus(11, 10)).toBe("OK");
    expect(stockStatus(1, 0)).toBe("OK");
  });
});
