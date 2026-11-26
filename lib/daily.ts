import "server-only";
import { prisma } from "./db";
import { stockAt } from "./financials";
import { saleWhere, type Viewer } from "./scope";

export type StockRow = {
  productId: string; locationId: string;
  opening: number; delivered: number; transferIn: number; sold: number; transferOut: number; other: number; closing: number;
};

/** Sales and stock for one day [start, end), limited to the given locations (empty = all). */
export async function dailyReport(start: Date, end: Date, viewer: Viewer, locationIds: string[]) {
  const scope = locationIds.length ? { locationId: { in: locationIds } } : {};

  const sales = await prisma.sale.findMany({
    where: { AND: [saleWhere(viewer), scope, { kind: "SALE", status: "COMPLETED", createdAt: { gte: start, lt: end } }] },
    include: {
      user: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      lines: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
      payments: { where: { paidAt: { lt: end } }, select: { amountCents: true } },
    },
  });
  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: start, lt: end }, sale: { AND: [saleWhere(viewer), scope] } },
    select: { method: true, amountCents: true },
  });

  const group = <K extends string>(keyOf: (s: (typeof sales)[number]) => [K, string]) => {
    const m = new Map<K, { label: string; count: number; total: number }>();
    for (const s of sales) {
      const [k, label] = keyOf(s);
      const row = m.get(k) ?? { label, count: 0, total: 0 };
      row.count += 1; row.total += s.totalCents;
      m.set(k, row);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  const byProduct = new Map<string, { product: (typeof sales)[number]["lines"][number]["product"]; units: number; amount: number }>();
  for (const s of sales) for (const l of s.lines) {
    const row = byProduct.get(l.productId) ?? { product: l.product, units: 0, amount: 0 };
    row.units += l.quantity * l.unitsPerPack;
    row.amount += l.quantity * l.unitPriceCents;
    byProduct.set(l.productId, row);
  }
  const methods = new Map<string, number>();
  for (const p of payments) methods.set(p.method, (methods.get(p.method) ?? 0) + p.amountCents);

  const totals = {
    count: sales.length,
    gross: sales.reduce((s, x) => s + x.totalCents + x.discountCents, 0),
    discounts: sales.reduce((s, x) => s + x.discountCents, 0),
    net: sales.reduce((s, x) => s + x.totalCents, 0),
    vat: sales.reduce((s, x) => s + x.vatCents, 0),
    creditGiven: sales.reduce((s, x) => s + Math.max(0, x.totalCents - x.payments.reduce((t, p) => t + p.amountCents, 0)), 0),
    received: payments.reduce((s, p) => s + p.amountCents, 0),
  };

  // Stock: closing at end of day, then work back through the day's movements.
  const closing = await stockAt(end, locationIds);
  const moves = await prisma.movement.findMany({ where: { createdAt: { gte: start, lt: end } } });
  const rows = new Map<string, StockRow>();
  const rowFor = (productId: string, locationId: string) => {
    const k = `${productId}|${locationId}`;
    let r = rows.get(k);
    if (!r) {
      r = { productId, locationId, opening: 0, delivered: 0, transferIn: 0, sold: 0, transferOut: 0, other: 0, closing: closing.get(k) ?? 0 };
      rows.set(k, r);
    }
    return r;
  };
  for (const k of closing.keys()) { const [p, l] = k.split("|"); rowFor(p, l); }
  const inScope = (l: string | null): l is string => !!l && (!locationIds.length || locationIds.includes(l));
  for (const m of moves) {
    if (m.type === "RECEIPT" && inScope(m.toLocationId)) {
      // Stock coming back from a cancelled sale counts against sales, not deliveries.
      const r = rowFor(m.productId, m.toLocationId);
      if (m.saleId) r.sold -= m.quantity; else if (m.purchaseOrderId) r.delivered += m.quantity; else r.other += m.quantity;
    } else if (m.type === "ISSUE" && inScope(m.fromLocationId)) {
      const r = rowFor(m.productId, m.fromLocationId);
      if (m.saleId) r.sold += m.quantity; else r.other -= m.quantity;
    } else if (m.type === "TRANSFER") {
      if (inScope(m.fromLocationId)) rowFor(m.productId, m.fromLocationId).transferOut += m.quantity;
      if (inScope(m.toLocationId)) rowFor(m.productId, m.toLocationId).transferIn += m.quantity;
    } else if (m.type === "ADJUSTMENT" && inScope(m.toLocationId)) {
      rowFor(m.productId, m.toLocationId).other += m.quantity;
    }
  }
  for (const r of rows.values()) r.opening = r.closing - r.delivered - r.transferIn + r.sold + r.transferOut - r.other;

  const [products, locations] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, sku: true, unit: true } }),
    prisma.location.findMany({ select: { id: true, name: true, code: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const stock = [...rows.values()]
    .filter((r) => r.opening || r.closing || r.delivered || r.transferIn || r.sold || r.transferOut || r.other)
    .map((r) => ({ ...r, product: productById.get(r.productId)!, location: locationById.get(r.locationId)! }))
    .sort((a, b) => a.location.name.localeCompare(b.location.name) || a.product.name.localeCompare(b.product.name));

  return {
    totals,
    byProduct: [...byProduct.values()].sort((a, b) => b.amount - a.amount),
    byRep: group((s) => [s.user.id, s.user.name]),
    byLocation: group((s) => [s.location?.id ?? "-", s.location?.name ?? "—"]),
    byMethod: [...methods.entries()].map(([method, amountCents]) => ({ method, amountCents })),
    stock,
  };
}
