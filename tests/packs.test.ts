import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cancelSale, createCustomerOpeningBalance, createSale, recordSalePayment } from "@/lib/sales";
import { createPurchaseOrder, createSupplierOpeningBalance, paySupplier, receivePurchaseOrder, purchaseOrderValue } from "@/lib/purchasing";
import { customerBalances, supplierBalances } from "@/lib/balances";
import { recordMovement } from "@/lib/stock";
import { prisma, qty, resetDb } from "./helpers";

let userId: string, shop: string, oil: string, carton: string, customer: string, supplier: string;

beforeEach(async () => {
  await resetDb();
  userId = (await prisma.user.create({ data: { email: "k@t.test", name: "Tester", passwordHash: "x" } })).id;
  shop = (await prisma.location.create({ data: { code: "SHOP", name: "Shop" } })).id;
  oil = (await prisma.product.create({
    data: { sku: "OIL-1L", name: "Engine Oil 1L", unit: "bottle", costCents: 460_000, priceRetailCents: 600_000, priceWholesaleCents: 540_000 },
  })).id;
  carton = (await prisma.productPack.create({
    data: { productId: oil, name: "Carton", unitsPerPack: 12, priceRetailCents: 6_900_000, priceWholesaleCents: 6_200_000 },
  })).id;
  customer = (await prisma.customer.create({ data: { name: "Garage", type: "WHOLESALE" } })).id;
  supplier = (await prisma.supplier.create({ data: { name: "Supplier" } })).id;
  await recordMovement(prisma, { type: "RECEIPT", productId: oil, toLocationId: shop, quantity: 30 }, userId);
});

afterAll(() => prisma.$disconnect());

describe("pack sizes", () => {
  it("sells cartons and singles from the same stock, priced per pack", async () => {
    const sale = await createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "WHOLESALE",
      lines: [{ productId: oil, packId: carton, quantity: 2 }, { productId: oil, quantity: 3 }] }, userId);
    expect(sale.totalCents).toBe(2 * 6_200_000 + 3 * 540_000);
    expect(await qty(oil, shop)).toBe(30 - 24 - 3);
    const lines = await prisma.saleLine.findMany({ where: { saleId: sale.id }, orderBy: { unitsPerPack: "desc" } });
    expect(lines[0]).toMatchObject({ packName: "Carton", unitsPerPack: 12, quantity: 2, unitCostCents: 12 * 460_000 });
    // One movement per product, in single units.
    const movements = await prisma.movement.findMany({ where: { saleId: sale.id } });
    expect(movements.map((m) => m.quantity)).toEqual([27]);

    await cancelSale(prisma, sale.id, "returned", userId);
    expect(await qty(oil, shop)).toBe(30);
  });

  it("checks stock across pack sizes in the same sale", async () => {
    await expect(createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: oil, packId: carton, quantity: 2 }, { productId: oil, quantity: 7 }] }, userId))
      .rejects.toThrow("Not enough stock at Shop: 30 available, 31 requested.");
  });

  it("rejects a pack from another product or an archived pack", async () => {
    const other = await prisma.product.create({ data: { sku: "X", name: "Other", priceRetailCents: 100 } });
    await expect(createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: other.id, packId: carton, quantity: 1 }] }, userId)).rejects.toThrow("pack size is not available");
    await prisma.productPack.update({ where: { id: carton }, data: { active: false } });
    await expect(createSale(prisma, { customerId: customer, locationId: shop, priceLevel: "RETAIL",
      lines: [{ productId: oil, packId: carton, quantity: 1 }] }, userId)).rejects.toThrow("pack size is not available");
  });

  it("receives purchase orders in packs and sets the single-unit cost", async () => {
    const wh = (await prisma.location.create({ data: { code: "WH", name: "Warehouse" } })).id;
    const po = await createPurchaseOrder(prisma, { supplierId: supplier, locationId: wh,
      lines: [{ productId: oil, packId: carton, quantity: 5, unitCostCents: 6_000_000 }] }, userId);
    const [line] = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
    expect(line).toMatchObject({ packName: "Carton", unitsPerPack: 12 });
    await receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 2 }], userId);
    expect(await qty(oil, wh)).toBe(24);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: oil } })).costCents).toBe(500_000);
    const loaded = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { lines: true } });
    expect(purchaseOrderValue(loaded, loaded.lines)).toBe(30_000_000);
  });
});

describe("opening balances", () => {
  it("adds to what a customer owes and can be paid off", async () => {
    const ob = await createCustomerOpeningBalance(prisma, customer, 25_000_000, null, userId);
    expect(ob.number).toBe("OB-000001");
    expect(ob.locationId).toBeNull();
    expect((await customerBalances([customer])).get(customer)).toBe(25_000_000);
    await recordSalePayment(prisma, ob.id, { amountCents: 10_000_000, method: "TRANSFER" }, userId);
    expect((await customerBalances([customer])).get(customer)).toBe(15_000_000);
    await cancelSale(prisma, ob.id, "Entered by mistake", userId);
    expect((await customerBalances([customer])).get(customer) ?? 0).toBe(0);
    expect(await qty(oil, shop)).toBe(30);
  });

  it("adds to what Trifold owes a supplier and can be paid off", async () => {
    const ob = await createSupplierOpeningBalance(prisma, supplier, 50_000_000, "Old ledger", userId);
    expect(ob.status).toBe("RECEIVED");
    expect((await supplierBalances([supplier])).get(supplier)).toBe(50_000_000);
    await paySupplier(prisma, ob.id, { amountCents: 20_000_000, method: "TRANSFER" }, userId);
    await expect(paySupplier(prisma, ob.id, { amountCents: 30_000_001, method: "CASH" }, userId)).rejects.toThrow("outstanding");
    expect((await supplierBalances([supplier])).get(supplier)).toBe(30_000_000);
  });

  it("rejects zero or negative amounts", async () => {
    await expect(createCustomerOpeningBalance(prisma, customer, 0, null, userId)).rejects.toThrow("above zero");
    await expect(createSupplierOpeningBalance(prisma, supplier, -5, null, userId)).rejects.toThrow("above zero");
  });
});
