import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cancelSale, createSale, recordSalePayment } from "@/lib/sales";
import { recordMovement, StockError } from "@/lib/stock";
import { prisma, qty, resetDb } from "./helpers";

let userId: string, shop: string, oil: string, filter: string, customer: string;

beforeEach(async () => {
  await resetDb();
  userId = (await prisma.user.create({ data: { email: "s@t.test", name: "Seller", passwordHash: "x" } })).id;
  shop = (await prisma.location.create({ data: { code: "SHOP", name: "Shop" } })).id;
  oil = (await prisma.product.create({
    data: { sku: "OIL-4L", name: "Engine Oil 4L", costCents: 1_000_000, priceRetailCents: 1_500_000, priceWholesaleCents: 1_300_000 },
  })).id;
  filter = (await prisma.product.create({
    data: { sku: "FLT-1", name: "Oil Filter", costCents: 200_000, priceRetailCents: 350_000, priceWholesaleCents: 300_000 },
  })).id;
  customer = (await prisma.customer.create({ data: { name: "Mama Ngozi Motors", type: "WHOLESALE" } })).id;
  for (const p of [oil, filter]) {
    await recordMovement(prisma, { type: "RECEIPT", productId: p, toLocationId: shop, quantity: 10 }, userId);
  }
});

afterAll(() => prisma.$disconnect());

const cash = (amountCents: number) => ({ amountCents, method: "CASH" as const });

describe("createSale", () => {
  it("prices from the level, issues stock, numbers invoices and records payment", async () => {
    const sale = await createSale(prisma, {
      locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: oil, quantity: 2 }, { productId: filter, quantity: 1 }],
      payment: cash(3_350_000),
    }, userId);
    expect(sale.number).toBe("INV-000001");
    expect(sale.totalCents).toBe(2 * 1_500_000 + 350_000);
    expect(await qty(oil, shop)).toBe(8);
    expect(await qty(filter, shop)).toBe(9);

    const lines = await prisma.saleLine.findMany({ where: { saleId: sale.id } });
    expect(lines.find((l) => l.productId === oil)?.unitCostCents).toBe(1_000_000);
    const movements = await prisma.movement.findMany({ where: { saleId: sale.id } });
    expect(movements.map((m) => m.reference)).toEqual(["INV-000001", "INV-000001"]);

    const second = await createSale(prisma, { locationId: shop, priceLevel: "WHOLESALE", customerId: customer,
      lines: [{ productId: oil, quantity: 1 }] }, userId);
    expect(second.number).toBe("INV-000002");
    expect(second.totalCents).toBe(1_300_000);
  });

  it("ignores price overrides unless allowed", async () => {
    const lines = [{ productId: oil, quantity: 1, unitPriceCents: 1 }];
    const a = await createSale(prisma, { locationId: shop, priceLevel: "RETAIL", lines, payment: cash(1_500_000) }, userId);
    expect(a.totalCents).toBe(1_500_000);
    const b = await createSale(prisma, { locationId: shop, priceLevel: "RETAIL", lines: [{ productId: oil, quantity: 1, unitPriceCents: 1_400_000 }],
      payment: cash(1_400_000), allowPriceOverride: true }, userId);
    expect(b.totalCents).toBe(1_400_000);
  });

  it("requires a customer for credit and refuses overpayment", async () => {
    await expect(createSale(prisma, { locationId: shop, priceLevel: "RETAIL", lines: [{ productId: oil, quantity: 1 }],
      payment: cash(500_000) }, userId)).rejects.toThrow("Choose a customer");
    await expect(createSale(prisma, { locationId: shop, priceLevel: "RETAIL", lines: [{ productId: oil, quantity: 1 }],
      payment: cash(9_000_000) }, userId)).rejects.toThrow("more than the total");
    const credit = await createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "WHOLESALE",
      lines: [{ productId: oil, quantity: 2 }], payment: cash(1_000_000) }, userId);
    expect(credit.totalCents - 1_000_000).toBe(1_600_000);
  });

  it("rolls back everything when stock is short", async () => {
    await expect(createSale(prisma, { locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: filter, quantity: 1 }, { productId: oil, quantity: 11 }], payment: cash(350_000 + 11 * 1_500_000) }, userId))
      .rejects.toThrow("Not enough stock at Shop: 10 available, 11 requested.");
    expect(await qty(filter, shop)).toBe(10);
    expect(await prisma.sale.count()).toBe(0);
    // The failed attempt must not use up an invoice number.
    const ok = await createSale(prisma, { locationId: shop, priceLevel: "RETAIL", lines: [{ productId: filter, quantity: 1 }], payment: cash(350_000) }, userId);
    expect(ok.number).toBe("INV-000001");
  });

  it("refuses products without a price and duplicate lines", async () => {
    await prisma.product.update({ where: { id: filter }, data: { priceWholesaleCents: 0 } });
    await expect(createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "WHOLESALE",
      lines: [{ productId: filter, quantity: 1 }] }, userId)).rejects.toThrow("has no wholesale price");
    await expect(createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: oil, quantity: 1 }, { productId: oil, quantity: 1 }] }, userId)).rejects.toThrow("listed twice");
  });
});

describe("payments and cancellation", () => {
  it("takes part payments up to the balance", async () => {
    const sale = await createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "WHOLESALE",
      lines: [{ productId: oil, quantity: 1 }] }, userId);
    await recordSalePayment(prisma, sale.id, { amountCents: 300_000, method: "TRANSFER" }, userId);
    await expect(recordSalePayment(prisma, sale.id, cash(1_000_001), userId)).rejects.toThrow("more than the ₦10,000.00 still owed");
    await recordSalePayment(prisma, sale.id, cash(1_000_000), userId);
    await expect(recordSalePayment(prisma, sale.id, cash(1), userId)).rejects.toThrow("already fully paid");
  });

  it("cancelling returns stock and refunds payments", async () => {
    const sale = await createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: oil, quantity: 3 }], payment: cash(2_000_000) }, userId);
    expect(await qty(oil, shop)).toBe(7);
    await expect(cancelSale(prisma, sale.id, " ", userId)).rejects.toBeInstanceOf(StockError);
    await cancelSale(prisma, sale.id, "Wrong product", userId);
    expect(await qty(oil, shop)).toBe(10);
    const payments = await prisma.payment.findMany({ where: { saleId: sale.id } });
    expect(payments.reduce((s, p) => s + p.amountCents, 0)).toBe(0);
    await expect(cancelSale(prisma, sale.id, "again", userId)).rejects.toThrow("already cancelled");
    await expect(recordSalePayment(prisma, sale.id, cash(1), userId)).rejects.toThrow("cancelled");
  });
});
