import type { PrismaClient } from "@prisma/client";
import { applyMovement, nextNumber, StockError, TX_OPTIONS, type Tx } from "./stock";
import { priceFor, type PaymentMethod, type PriceLevel } from "./money";
import { formatMoney } from "./format";

/** quantity counts packs when packId is set (e.g. 2 cartons), otherwise single units. */
export type SaleLineInput = { productId: string; packId?: string | null; quantity: number; unitPriceCents?: number | null };

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
  /** Discount off the whole sale, in kobo. Needs allowDiscount. */
  discountCents?: number;
  allowDiscount?: boolean;
  /** VAT rate (%) contained in the prices, e.g. 7.5. Prices are VAT-inclusive. */
  vatRate?: number;
};

/** The VAT inside a VAT-inclusive amount, e.g. 7.5% of ₦10,750 is ₦750. */
export function vatIncluded(amountCents: number, ratePercent: number) {
  if (!ratePercent) return 0;
  return Math.round((amountCents * ratePercent) / (100 + ratePercent));
}

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
      const key = `${line.productId}:${line.packId ?? ""}`;
      if (seen.has(key)) throw new StockError("A product is listed twice in the same pack size; combine the quantities into one line.");
      seen.add(key);
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) throw new StockError("Product not found.");
      const pack = line.packId ? await tx.productPack.findUnique({ where: { id: line.packId } }) : null;
      if (line.packId && (!pack || pack.productId !== product.id || !pack.active)) {
        throw new StockError(`That pack size is not available for ${product.name}.`);
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new StockError("Quantities must be whole numbers above zero.");
      const itemName = pack ? `${product.name} (${pack.name})` : product.name;
      const listPrice = priceFor(pack ?? product, input.priceLevel);
      let unitPriceCents = listPrice;
      if (input.allowPriceOverride && line.unitPriceCents != null) {
        assertAmount(line.unitPriceCents, `Price for ${itemName}`);
        unitPriceCents = line.unitPriceCents;
      }
      if (unitPriceCents <= 0) {
        throw new StockError(`${itemName} has no ${input.priceLevel.toLowerCase()} price. Set one on the product first.`);
      }
      const unitsPerPack = pack?.unitsPerPack ?? 1;
      lines.push({ product, pack, unitsPerPack, quantity: line.quantity, unitPriceCents });
    }

    const subtotalCents = lines.reduce((s, l) => s + l.quantity * l.unitPriceCents, 0);
    const discountCents = input.discountCents ?? 0;
    assertAmount(discountCents, "Discount");
    if (discountCents > 0 && !input.allowDiscount) throw new StockError("Only management can give discounts.");
    if (discountCents >= subtotalCents) throw new StockError("The discount must be less than the sale total.");
    const totalCents = subtotalCents - discountCents;
    const vatRate = input.vatRate ?? 0;
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
        discountCents,
        vatRate,
        vatCents: vatIncluded(totalCents, vatRate),
        note: input.note?.trim() || null,
        userId,
        lines: {
          create: lines.map((l) => ({
            productId: l.product.id,
            packId: l.pack?.id ?? null,
            packName: l.pack?.name ?? null,
            unitsPerPack: l.unitsPerPack,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            unitCostCents: l.product.costCents * l.unitsPerPack,
          })),
        },
      },
    });

    // One stock movement per product, in single units, even if sold in several pack sizes.
    const units = new Map<string, number>();
    for (const l of lines) units.set(l.product.id, (units.get(l.product.id) ?? 0) + l.quantity * l.unitsPerPack);
    for (const [productId, quantity] of units) {
      await applyMovement(
        tx,
        { type: "ISSUE", productId, fromLocationId: input.locationId, quantity, reference: number },
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

    const units = new Map<string, number>();
    if (sale.lines.length > 0 && !sale.locationId) throw new StockError("This sale has no location to return stock to.");
    for (const l of sale.lines) units.set(l.productId, (units.get(l.productId) ?? 0) + l.quantity * l.unitsPerPack);
    for (const [productId, quantity] of units) {
      await applyMovement(
        tx,
        { type: "RECEIPT", productId, toLocationId: sale.locationId!, quantity, reference: `${sale.number} cancelled` },
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

/**
 * Records what a customer already owed when Trifold started using the system.
 * It appears as an invoice (OB-000001) with no items, so normal payments clear it.
 */
export async function createCustomerOpeningBalance(db: PrismaClient, customerId: string, amountCents: number, note: string | null, userId: string) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new StockError("Enter an amount above zero.");
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer || !customer.active) throw new StockError("Customer not found.");
    return tx.sale.create({
      data: {
        kind: "OPENING_BALANCE",
        number: await nextNumber(tx, "OB"),
        customerId,
        priceLevel: customer.type,
        totalCents: amountCents,
        note: note?.trim() || "Opening balance",
        userId,
      },
    });
  }, TX_OPTIONS);
}
