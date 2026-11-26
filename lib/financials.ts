import "server-only";
import { prisma } from "./db";
import { MONEY_IN } from "./expenses";
import { parseMoneyToCents } from "./format";

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Sales counted for a period: completed, or cancelled only after the period ended. */
function liveSalesAt(end: Date) {
  return { kind: "SALE", createdAt: { lt: end }, OR: [{ status: "COMPLETED" }, { cancelledAt: { gte: end } }] };
}

/** Income statement for [from, to). Prices are VAT-inclusive, so VAT is taken out of sales. */
export async function incomeStatement(from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: { ...liveSalesAt(to), createdAt: { gte: from, lt: to } },
    include: { lines: true },
  });
  const grossSales = sum(sales.map((s) => s.totalCents + s.discountCents));
  const discounts = sum(sales.map((s) => s.discountCents));
  const vat = sum(sales.map((s) => s.vatCents));
  const revenue = grossSales - discounts - vat;
  const costOfSales = sum(sales.flatMap((s) => s.lines.map((l) => l.quantity * l.unitCostCents)));
  const grossProfit = revenue - costOfSales;

  const entries = await prisma.expense.findMany({ where: { date: { gte: from, lt: to }, kind: { in: ["EXPENSE", "REBATE", "OTHER_INCOME"] } } });
  const byCategory = (kind: string) => {
    const m = new Map<string, number>();
    for (const e of entries.filter((x) => x.kind === kind)) m.set(e.category, (m.get(e.category) ?? 0) + e.amountCents);
    return [...m.entries()].map(([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents);
  };
  const expenses = byCategory("EXPENSE");
  const rebates = byCategory("REBATE");
  const totalRebates = sum(rebates.map((e) => e.amountCents));
  const otherIncome = byCategory("OTHER_INCOME");
  const totalExpenses = sum(expenses.map((e) => e.amountCents));
  const totalOtherIncome = sum(otherIncome.map((e) => e.amountCents));
  return {
    saleCount: sales.length, grossSales, discounts, vat, revenue, costOfSales, grossProfit,
    rebates, totalRebates, expenses, totalExpenses, otherIncome, totalOtherIncome,
    netProfit: grossProfit + totalRebates - totalExpenses + totalOtherIncome,
  };
}

/** Quantity of each product (all locations) at a moment, rebuilt from today's stock and later movements. */
export async function stockAt(asOf: Date, locationIds?: string[]) {
  const loc = locationIds?.length ? { locationId: { in: locationIds } } : {};
  const [levels, later] = await Promise.all([
    prisma.stockLevel.findMany({ where: loc, select: { productId: true, locationId: true, quantity: true } }),
    prisma.movement.findMany({ where: { createdAt: { gte: asOf } }, select: { productId: true, type: true, fromLocationId: true, toLocationId: true, quantity: true } }),
  ]);
  const key = (p: string, l: string) => `${p}|${l}`;
  const qty = new Map<string, number>();
  for (const l of levels) qty.set(key(l.productId, l.locationId), l.quantity);
  const inScope = (l: string | null) => !!l && (!locationIds?.length || locationIds.includes(l));
  // Undo each later movement.
  for (const m of later) {
    for (const [locId, delta] of movementDeltas(m)) {
      if (!inScope(locId)) continue;
      const k = key(m.productId, locId);
      qty.set(k, (qty.get(k) ?? 0) - delta);
    }
  }
  return qty;
}

/** The stock change a movement made at each location. */
export function movementDeltas(m: { type: string; fromLocationId: string | null; toLocationId: string | null; quantity: number }): [string, number][] {
  switch (m.type) {
    case "RECEIPT": return m.toLocationId ? [[m.toLocationId, m.quantity]] : [];
    case "ISSUE": return m.fromLocationId ? [[m.fromLocationId, -m.quantity]] : [];
    case "TRANSFER": return [[m.fromLocationId!, -m.quantity], [m.toLocationId!, m.quantity]];
    case "ADJUSTMENT": return m.toLocationId ? [[m.toLocationId, m.quantity]] : [];
    default: return [];
  }
}

/** Management balance sheet at the end of `asOf` (exclusive bound). */
export async function balanceSheet(asOf: Date, openingCashSetting: string) {
  const openingCash = parseMoneyToCents(openingCashSetting) ?? 0;

  const [customerPayments, supplierPayments, entries] = await Promise.all([
    prisma.payment.aggregate({ where: { paidAt: { lt: asOf } }, _sum: { amountCents: true } }),
    prisma.supplierPayment.findMany({ where: { paidAt: { lt: asOf } }, select: { amountCents: true, purchaseOrderId: true } }),
    prisma.expense.findMany({ where: { date: { lt: asOf } } }),
  ]);
  const signed = (e: { kind: string; amountCents: number }) => (MONEY_IN[e.kind] ? e.amountCents : -e.amountCents);
  const cash = openingCash + (customerPayments._sum.amountCents ?? 0) - sum(supplierPayments.map((p) => p.amountCents)) + sum(entries.map(signed));

  // Customers: invoices raised (incl. opening balances) less payments received, per customer.
  const sales = await prisma.sale.findMany({
    where: { createdAt: { lt: asOf }, customerId: { not: null }, OR: [{ status: "COMPLETED" }, { cancelledAt: { gte: asOf } }] },
    select: { customerId: true, totalCents: true, vatCents: true, kind: true, payments: { where: { paidAt: { lt: asOf } }, select: { amountCents: true } } },
  });
  const perCustomer = new Map<string, number>();
  for (const s of sales) perCustomer.set(s.customerId!, (perCustomer.get(s.customerId!) ?? 0) + s.totalCents - sum(s.payments.map((p) => p.amountCents)));
  const receivables = sum([...perCustomer.values()].filter((b) => b > 0));
  const customerCredits = -sum([...perCustomer.values()].filter((b) => b < 0));

  // Inventory at current cost.
  const [qty, products] = await Promise.all([stockAt(asOf), prisma.product.findMany({ select: { id: true, costCents: true } })]);
  const cost = new Map(products.map((p) => [p.id, p.costCents]));
  let inventory = 0;
  for (const [k, q] of qty) inventory += Math.max(0, q) * (cost.get(k.split("|")[0]) ?? 0);

  // Suppliers: goods received (and opening balances) less payments, per order.
  const orders = await prisma.purchaseOrder.findMany({
    where: { createdAt: { lt: asOf }, status: { not: "CANCELLED" } },
    include: { lines: true, movements: { where: { createdAt: { lt: asOf }, type: "RECEIPT" }, select: { productId: true, quantity: true } } },
  });
  const paidByOrder = new Map<string, number>();
  for (const p of supplierPayments) paidByOrder.set(p.purchaseOrderId, (paidByOrder.get(p.purchaseOrderId) ?? 0) + p.amountCents);
  const perSupplier = new Map<string, number>();
  for (const po of orders) {
    let received: number;
    if (po.kind === "OPENING_BALANCE") received = po.openingAmountCents ?? 0;
    else {
      const unitCost = new Map<string, number>();
      for (const l of po.lines) if (!unitCost.has(l.productId)) unitCost.set(l.productId, l.unitCostCents / l.unitsPerPack);
      received = Math.round(sum(po.movements.map((m) => m.quantity * (unitCost.get(m.productId) ?? 0))));
    }
    const owed = received - (paidByOrder.get(po.id) ?? 0);
    perSupplier.set(po.supplierId, (perSupplier.get(po.supplierId) ?? 0) + owed);
  }
  const payables = sum([...perSupplier.values()].filter((b) => b > 0));
  const supplierAdvances = -sum([...perSupplier.values()].filter((b) => b < 0));

  const outputVat = sum(sales.filter((s) => s.kind === "SALE").map((s) => s.vatCents))
    + (await walkInVat(asOf));
  const vatPaid = sum(entries.filter((e) => e.kind === "VAT_REMITTANCE").map((e) => e.amountCents));
  const vatPayable = outputVat - vatPaid;

  const totalAssets = cash + receivables + inventory + supplierAdvances;
  const totalLiabilities = payables + customerCredits + vatPayable;
  const equity = totalAssets - totalLiabilities;

  const capital = sum(entries.filter((e) => e.kind === "CAPITAL").map((e) => e.amountCents))
    - sum(entries.filter((e) => e.kind === "DRAWING").map((e) => e.amountCents));
  const profitToDate = (await incomeStatement(new Date(0), asOf)).netProfit;

  return {
    cash, receivables, inventory, supplierAdvances, totalAssets,
    payables, customerCredits, vatPayable, totalLiabilities,
    equity, capital, profitToDate, openingPosition: equity - capital - profitToDate,
  };
}

/** VAT on walk-in sales (no customer), which the customer query above skips. */
async function walkInVat(asOf: Date) {
  const agg = await prisma.sale.aggregate({
    where: { ...liveSalesAt(asOf), customerId: null },
    _sum: { vatCents: true },
  });
  return agg._sum.vatCents ?? 0;
}
