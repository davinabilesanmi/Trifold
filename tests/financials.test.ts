import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSale, cancelSale, recordSalePayment, vatIncluded } from "@/lib/sales";
import { createPurchaseOrder, paySupplier, receivePurchaseOrder } from "@/lib/purchasing";
import { balanceSheet, incomeStatement, stockAt } from "@/lib/financials";
import { dailyReport } from "@/lib/daily";
import { recordMovement } from "@/lib/stock";
import { ROLE_PRESETS } from "@/lib/permissions";
import { prisma, resetDb } from "./helpers";

const N = (naira: number) => naira * 100;
let userId: string, depot: string, outlet: string, cement: string, customer: string, supplier: string;
const owner = () => ({ id: userId, permissions: ROLE_PRESETS.OWNER, locationIds: [] as string[] });
const later = () => new Date(Date.now() + 60_000);

beforeEach(async () => {
  await resetDb();
  userId = (await prisma.user.create({ data: { email: "f@t.test", name: "Owner", passwordHash: "x" } })).id;
  depot = (await prisma.location.create({ data: { code: "DEPOT", name: "Depot" } })).id;
  outlet = (await prisma.location.create({ data: { code: "IKJ", name: "Ikeja Outlet" } })).id;
  cement = (await prisma.product.create({
    data: { sku: "DAN-425", name: "Dangote 42.5R", unit: "bag", costCents: N(8600), priceRetailCents: N(10750), priceWholesaleCents: N(9675) },
  })).id;
  customer = (await prisma.customer.create({ data: { name: "Builder Ltd", type: "WHOLESALE" } })).id;
  supplier = (await prisma.supplier.create({ data: { name: "Dangote Cement Plc" } })).id;
  // 600 bags delivered at ₦8,600; ₦3,000,000 paid so far.
  const po = await createPurchaseOrder(prisma, { supplierId: supplier, locationId: depot, lines: [{ productId: cement, quantity: 600, unitCostCents: N(8600) }] }, userId);
  const [line] = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: po.id } });
  await receivePurchaseOrder(prisma, po.id, [{ lineId: line.id, quantity: 600 }], userId);
  await paySupplier(prisma, po.id, { amountCents: N(3_000_000), method: "TRANSFER" }, userId);
});

afterAll(() => prisma.$disconnect());

describe("VAT and discounts", () => {
  it("extracts VAT from VAT-inclusive prices", () => {
    expect(vatIncluded(N(10750), 7.5)).toBe(N(750));
    expect(vatIncluded(N(10750), 0)).toBe(0);
  });

  it("applies a management discount and stores the VAT inside the total", async () => {
    const sale = await createSale(prisma, { customerId: customer, locationId: depot, priceLevel: "RETAIL",
      lines: [{ productId: cement, quantity: 10 }], discountCents: N(7500), allowDiscount: true, vatRate: 7.5 }, userId);
    expect(sale.discountCents).toBe(N(7500));
    expect(sale.totalCents).toBe(N(100_000)); // 10 × 10,750 − 7,500
    expect(sale.vatCents).toBe(Math.round(N(100_000) * 7.5 / 107.5));
  });

  it("refuses discounts from staff without the responsibility, and silly discounts", async () => {
    await expect(createSale(prisma, { customerId: customer, locationId: depot, priceLevel: "RETAIL",
      lines: [{ productId: cement, quantity: 1 }], discountCents: N(100) }, userId)).rejects.toThrow("Only management");
    await expect(createSale(prisma, { customerId: customer, locationId: depot, priceLevel: "RETAIL",
      lines: [{ productId: cement, quantity: 1 }], discountCents: N(10750), allowDiscount: true }, userId)).rejects.toThrow("less than the sale total");
  });
});

describe("financial statements", () => {
  it("builds an income statement net of VAT, discounts, cost of sales and expenses", async () => {
    await createSale(prisma, { customerId: customer, locationId: depot, priceLevel: "RETAIL",
      lines: [{ productId: cement, quantity: 100 }], discountCents: N(25_000), allowDiscount: true, vatRate: 7.5,
      payment: { amountCents: N(500_000), method: "TRANSFER" } }, userId);
    const cancelled = await createSale(prisma, { customerId: customer, locationId: depot, priceLevel: "RETAIL",
      lines: [{ productId: cement, quantity: 5 }], vatRate: 7.5 }, userId);
    await cancelSale(prisma, cancelled.id, "mistake", userId);
    await prisma.expense.createMany({ data: [
      { kind: "EXPENSE", category: "Haulage and transport", amountCents: N(60_000), date: new Date(), userId },
      { kind: "OTHER_INCOME", category: "Pallet sales", amountCents: N(5_000), date: new Date(), userId },
      { kind: "DRAWING", category: "Owner", amountCents: N(40_000), date: new Date(), userId },
    ] });

    const is = await incomeStatement(new Date(Date.now() - 86_400_000), later());
    const total = N(1_075_000 - 25_000);
    const vat = Math.round(total * 7.5 / 107.5);
    expect(is.saleCount).toBe(1);
    expect(is.grossSales).toBe(N(1_075_000));
    expect(is.discounts).toBe(N(25_000));
    expect(is.vat).toBe(vat);
    expect(is.revenue).toBe(total - vat);
    expect(is.costOfSales).toBe(N(860_000));
    expect(is.totalExpenses).toBe(N(60_000)); // drawings are not an expense
    expect(is.netProfit).toBe(total - vat - N(860_000) - N(60_000) + N(5_000));
  });

  it("builds a balance sheet that balances and tracks cash, debts, stock and VAT", async () => {
    const sale = await createSale(prisma, { customerId: customer, locationId: depot, priceLevel: "RETAIL",
      lines: [{ productId: cement, quantity: 100 }], vatRate: 7.5 }, userId);
    await recordSalePayment(prisma, sale.id, { amountCents: N(700_000), method: "TRANSFER" }, userId);
    await prisma.expense.createMany({ data: [
      { kind: "EXPENSE", category: "Diesel and fuel", amountCents: N(50_000), date: new Date(), userId },
      { kind: "VAT_REMITTANCE", category: "FIRS", amountCents: N(20_000), date: new Date(), userId },
      { kind: "CAPITAL", category: "Owner", amountCents: N(1_000_000), date: new Date(), userId },
    ] });

    const bs = await balanceSheet(later(), "2,000,000");
    expect(bs.cash).toBe(N(2_000_000 + 700_000 - 3_000_000 - 50_000 - 20_000 + 1_000_000));
    expect(bs.receivables).toBe(N(1_075_000 - 700_000));
    expect(bs.inventory).toBe(500 * N(8600));
    expect(bs.payables).toBe(600 * N(8600) - N(3_000_000));
    expect(bs.vatPayable).toBe(vatIncluded(N(1_075_000), 7.5) - N(20_000));
    expect(bs.totalAssets - bs.totalLiabilities).toBe(bs.equity);
    expect(bs.capital).toBe(N(1_000_000));
    expect(bs.capital + bs.profitToDate + bs.openingPosition).toBe(bs.equity);

    // Before anything happened, there was only the opening cash.
    const before = await balanceSheet(new Date(Date.now() - 86_400_000), "2,000,000");
    expect(before.cash).toBe(N(2_000_000));
    expect(before.inventory).toBe(0);
    expect(before.payables).toBe(0);
  });

  it("rebuilds stock at an earlier moment", async () => {
    const mid = new Date();
    await new Promise((r) => setTimeout(r, 20));
    await recordMovement(prisma, { type: "TRANSFER", productId: cement, fromLocationId: depot, toLocationId: outlet, quantity: 200 }, userId);
    const then = await stockAt(mid);
    expect(then.get(`${cement}|${depot}`)).toBe(600);
    expect(then.get(`${cement}|${outlet}`) ?? 0).toBe(0);
    const now = await stockAt(later());
    expect(now.get(`${cement}|${depot}`)).toBe(400);
    expect(now.get(`${cement}|${outlet}`)).toBe(200);
  });
});

describe("daily report", () => {
  it("summarises the day's sales and stock flow per outlet", async () => {
    await recordMovement(prisma, { type: "TRANSFER", productId: cement, fromLocationId: depot, toLocationId: outlet, quantity: 200 }, userId);
    await createSale(prisma, { locationId: outlet, priceLevel: "RETAIL", lines: [{ productId: cement, quantity: 30 }], vatRate: 7.5,
      payment: { amountCents: 30 * N(10750), method: "TRANSFER" } }, userId);
    const start = new Date(Date.now() - 3_600_000);
    const report = await dailyReport(start, later(), owner(), []);
    expect(report.totals.count).toBe(1);
    expect(report.totals.received).toBe(30 * N(10750));
    const outletRow = report.stock.find((r) => r.locationId === outlet)!;
    expect(outletRow).toMatchObject({ opening: 0, transferIn: 200, sold: 30, closing: 170 });
    const depotRow = report.stock.find((r) => r.locationId === depot)!;
    expect(depotRow).toMatchObject({ opening: 0, delivered: 600, transferOut: 200, closing: 400 });

    // An outlet manager tied to the outlet sees only the outlet.
    const manager = { id: userId, permissions: ROLE_PRESETS.OUTLET_MANAGER, locationIds: [outlet] };
    const scoped = await dailyReport(start, later(), manager, [outlet]);
    expect(scoped.stock.map((r) => r.locationId)).toEqual([outlet]);
  });
});
