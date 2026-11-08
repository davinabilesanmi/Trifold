import type { PrismaClient, PurchaseOrder, PurchaseOrderLine } from "@prisma/client";
import { applyMovement, nextNumber, StockError, TX_OPTIONS } from "./stock";
import type { PaymentMethod } from "./money";
import { formatMoney } from "./format";

export const PO_STATUS_LABELS: Record<string, string> = {
  ORDERED: "Ordered",
  PARTIAL: "Part received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export type PurchaseOrderInput = {
  supplierId: string;
  locationId: string;
  lines: { productId: string; quantity: number; unitCostCents: number }[];
  note?: string | null;
};

/**
 * What the order is worth to the supplier: the full order while goods are
 * still expected, only what arrived once it is closed, nothing if cancelled.
 */
export function purchaseOrderValue(po: Pick<PurchaseOrder, "status">, lines: Pick<PurchaseOrderLine, "quantity" | "receivedQuantity" | "unitCostCents">[]) {
  if (po.status === "CANCELLED") return 0;
  const qty = (l: (typeof lines)[number]) => (po.status === "RECEIVED" ? l.receivedQuantity : l.quantity);
  return lines.reduce((s, l) => s + qty(l) * l.unitCostCents, 0);
}

export async function createPurchaseOrder(db: PrismaClient, input: PurchaseOrderInput, userId: string) {
  if (input.lines.length === 0) throw new StockError("Add at least one product to the order.");
  const ids = new Set<string>();
  for (const l of input.lines) {
    if (ids.has(l.productId)) throw new StockError("A product is listed twice; combine the quantities into one line.");
    ids.add(l.productId);
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new StockError("Quantities must be whole numbers above zero.");
    if (!Number.isInteger(l.unitCostCents) || l.unitCostCents < 0) throw new StockError("Unit costs must be zero or more.");
  }
  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier || !supplier.active) throw new StockError("Choose an active supplier.");
    const location = await tx.location.findUnique({ where: { id: input.locationId } });
    if (!location || !location.active) throw new StockError("Choose an active location to receive into.");
    const products = await tx.product.findMany({ where: { id: { in: [...ids] }, active: true } });
    if (products.length !== ids.size) throw new StockError("One of the products is missing or archived.");
    return tx.purchaseOrder.create({
      data: {
        number: await nextNumber(tx, "PO"),
        supplierId: supplier.id,
        locationId: location.id,
        note: input.note?.trim() || null,
        userId,
        lines: { create: input.lines },
      },
    });
  }, TX_OPTIONS);
}

/** Receives some or all outstanding quantities on an order into its location. */
export async function receivePurchaseOrder(db: PrismaClient, poId: string, receipts: { lineId: string; quantity: number }[], userId: string) {
  return db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: { include: { product: true } } } });
    if (!po) throw new StockError("Purchase order not found.");
    if (po.status !== "ORDERED" && po.status !== "PARTIAL") throw new StockError(`This order is ${PO_STATUS_LABELS[po.status].toLowerCase()}.`);

    let any = false;
    for (const r of receipts) {
      if (r.quantity === 0) continue;
      const line = po.lines.find((l) => l.id === r.lineId);
      if (!line) throw new StockError("Order line not found.");
      const remaining = line.quantity - line.receivedQuantity;
      if (!Number.isInteger(r.quantity) || r.quantity < 0) throw new StockError("Received quantities must be whole numbers.");
      if (r.quantity > remaining) {
        throw new StockError(`Only ${remaining} of ${line.product.name} still to come on this order; you entered ${r.quantity}.`);
      }
      any = true;
      await applyMovement(
        tx,
        { type: "RECEIPT", productId: line.productId, toLocationId: po.locationId, quantity: r.quantity, reference: po.number },
        userId,
        { purchaseOrderId: po.id },
      );
      line.receivedQuantity += r.quantity;
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: line.receivedQuantity } });
      // Keep the product's cost at the latest purchase price, for valuation and profit.
      await tx.product.update({ where: { id: line.productId }, data: { costCents: line.unitCostCents } });
    }
    if (!any) throw new StockError("Enter a quantity for at least one product.");

    const complete = po.lines.every((l) => l.receivedQuantity >= l.quantity);
    return tx.purchaseOrder.update({ where: { id: po.id }, data: { status: complete ? "RECEIVED" : "PARTIAL" } });
  }, TX_OPTIONS);
}

/** Cancels an order with nothing received, or closes a part-received one (the rest isn't coming). */
export async function closePurchaseOrder(db: PrismaClient, poId: string) {
  return db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { payments: true } });
    if (!po) throw new StockError("Purchase order not found.");
    if (po.status === "ORDERED") {
      if (po.payments.length > 0) throw new StockError("Payments have been made on this order, so it can't be cancelled.");
      return tx.purchaseOrder.update({ where: { id: poId }, data: { status: "CANCELLED" } });
    }
    if (po.status === "PARTIAL") return tx.purchaseOrder.update({ where: { id: poId }, data: { status: "RECEIVED" } });
    throw new StockError(`This order is already ${PO_STATUS_LABELS[po.status].toLowerCase()}.`);
  }, TX_OPTIONS);
}

/** Records a payment to the supplier. Paying before delivery is allowed, up to the order value. */
export async function paySupplier(
  db: PrismaClient,
  poId: string,
  payment: { amountCents: number; method: PaymentMethod; reference?: string | null },
  userId: string,
) {
  return db.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true, payments: true } });
    if (!po) throw new StockError("Purchase order not found.");
    if (po.status === "CANCELLED") throw new StockError("This order is cancelled.");
    if (!Number.isInteger(payment.amountCents) || payment.amountCents <= 0) throw new StockError("Enter an amount above zero.");
    const paid = po.payments.reduce((s, p) => s + p.amountCents, 0);
    const balance = purchaseOrderValue(po, po.lines) - paid;
    if (payment.amountCents > balance) {
      throw new StockError(balance > 0 ? `That's more than the ${formatMoney(balance)} outstanding on ${po.number}.` : `${po.number} is already fully paid.`);
    }
    return tx.supplierPayment.create({
      data: { purchaseOrderId: po.id, amountCents: payment.amountCents, method: payment.method, reference: payment.reference?.trim() || null, userId },
    });
  }, TX_OPTIONS);
}
