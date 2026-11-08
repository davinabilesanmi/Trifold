import type { PrismaClient } from "@prisma/client";
import { applyMovement, nextNumber, StockError, TX_OPTIONS, type Tx } from "./stock";
import { priceFor, type PaymentMethod, type PriceLevel } from "./money";
import { formatMoney } from "./format";

export type SaleLineInput = { productId: string; quantity: number; unitPriceCents?: number | null };

export type SaleInput = {
  customerId?: string | null;
  locationId: string;
  priceLevel: PriceLevel;
  lines: SaleLineInput[];
  note?: string | null;
  /** Amount paid now. Anything less than the total is owed by the customer. */
  payment?: { amountCents: number; method: PaymentMethod; reference?: string | null };
  /** Whether the user may change the list price on a line. */
  allowPriceOverride?: boolean;
};

function assertAmount(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) throw new StockError(`${label} must be zero or more.`);
}

/** Creates a sale, issues the stock from the sale location and records any payment, atomically. */
export async function createSale(db: PrismaClient, input: SaleInput, userId: string) {
  if (input.lines.length === 0) throw new StockError("Add at least one product to the sale.");

  return db.$transaction(async (tx) => {
    const customer = input.customerId
      ? await tx.customer.findUnique({ where: { id: input.customerId } })
      : null;
    if (input.customerId && !customer) throw new StockError("Customer not found.");
    if (customer && !customer.active) throw new StockError(`${customer.name} is archived.`);

    const seen = new Set<string>();
    const lines = [];
    for (const line of input.lines) {
      if (seen.has(line.productId)) throw new StockError("A product is listed twice; combine the quantities into one line.");
      seen.add(line.productId);
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new StockError("Product not found.");
      const listPrice = priceFor(product, input.priceLevel);
      let unitPriceCents = listPrice;
      if (input.allowPriceOverride && line.unitPriceCents != null) {
        assertAmount(line.unitPriceCents, `Price for ${product.name}`);
        unitPriceCents = line.unitPriceCents;
      }
      if (unitPriceCents <= 0) {
        throw new StockError(`${product.name} has no ${input.priceLevel.toLowerCase()} price. Set one on the product first.`);
      }
      lines.push({ product, quantity: line.quantity, unitPriceCents });
    }

    const totalCents = lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0);
    const paid = input.payment?.amountCents ?? 0;
    assertAmount(paid, "Amount paid");
    if (paid > totalCents) throw new StockError(`Amount paid (${formatMoney(paid)}) is more than the total (${formatMoney(totalCents)}).`);
    if (paid < totalCents && !customer) {
      throw new StockError("Choose a customer to sell on credit or part-payment. Walk-in sales must be paid in full.");
    }

    const number = await nextNumber(tx, "INV");
    const sale = await tx.sale.create({
      data: {
        number,
        customerId: customer?.id ?? null,
        locationId: input.locationId,
        priceLevel: input.priceLevel,
        totalCents,
        note: input.note?.trim() || null,
        userId,
        lines: {
          create: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            unitCostCents: l.product.costCents,
          })),
        },
      },
    });

    for (const l of lines) {
      await applyMovement(
        tx,
        { type: "ISSUE", productId: l.product.id, fromLocationId: input.locationId, quantity: l.quantity, reference: number },
        userId,
        { saleId: sale.id },
      );
    }

    if (paid > 0) {
      await tx.payment.create({
        data: { saleId: sale.id, amountCents: paid, method: input.payment!.method, reference: input.payment!.reference?.trim() || null, userId },
      });
    }
    return sale;
  }, TX_OPTIONS);
}

async function paidOnSale(tx: Tx, saleId: string) {
  const agg = await tx.payment.aggregate({ where: { saleId }, _sum: { amountCents: true } });
  return agg._sum.amountCents ?? 0;
}

/** Records a customer payment towards a sale's outstanding balance. */
export async function recordSalePayment(
  db: PrismaClient,
  saleId: string,
  payment: { amountCents: number; method: PaymentMethod; reference?: string | null },
  userId: string,
) {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new StockError("Sale not found.");
    if (sale.status !== "COMPLETED") throw new StockError("This sale has been cancelled.");
    if (!Number.isInteger(payment.amountCents) || payment.amountCents <= 0) throw new StockError("Enter an amount above zero.");
    const balance = sale.totalCents - (await paidOnSale(tx, saleId));
    if (balance <= 0) throw new StockError("This sale is already fully paid.");
    if (payment.amountCents > balance) {
      throw new StockError(`That's more than the ${formatMoney(balance)} still owed on ${sale.number}.`);
    }
    return tx.payment.create({
      data: { saleId, amountCents: payment.amountCents, method: payment.method, reference: payment.reference?.trim() || null, userId },
    });
  }, TX_OPTIONS);
}

/** Cancels a sale: returns its stock to the sale location and refunds what was paid. */
export async function cancelSale(db: PrismaClient, saleId: string, reason: string, userId: string) {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lines: true } });
    if (!sale) throw new StockError("Sale not found.");
    if (sale.status === "CANCELLED") throw new StockError("This sale is already cancelled.");
    if (!reason.trim()) throw new StockError("Give a reason for cancelling.");

    for (const line of sale.lines) {
      await applyMovement(
        tx,
        { type: "RECEIPT", productId: line.productId, toLocationId: sale.locationId, quantity: line.quantity, reference: `${sale.number} cancelled` },
        userId,
        { saleId: sale.id },
      );
    }
    const paid = await paidOnSale(tx, saleId);
    if (paid > 0) {
      await tx.payment.create({ data: { saleId, amountCents: -paid, method: "REFUND", reference: "Sale cancelled", userId } });
    }
    return tx.sale.update({
      where: { id: saleId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.trim() },
    });
  }, TX_OPTIONS);
}
