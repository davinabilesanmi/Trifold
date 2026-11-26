import type { Prisma, PrismaClient } from "@prisma/client";

export const MOVEMENT_TYPES = ["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  RECEIPT: "Receive",
  ISSUE: "Issue",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjust",
};

export const MOVEMENT_DESCRIPTIONS: Record<MovementType, string> = {
  RECEIPT: "Stock arriving at a location, e.g. a supplier delivery.",
  ISSUE: "Stock leaving a location, e.g. a sale, dispatch or write-off.",
  TRANSFER: "Move stock from one location to another.",
  ADJUSTMENT: "Correct a location's quantity after a stock count.",
};

export function isMovementType(value: unknown): value is MovementType {
  return typeof value === "string" && (MOVEMENT_TYPES as readonly string[]).includes(value);
}

type Common = { productId: string; reference?: string | null; note?: string | null };

export type MovementInput =
  | (Common & { type: "RECEIPT"; toLocationId: string; quantity: number })
  | (Common & { type: "ISSUE"; fromLocationId: string; quantity: number })
  | (Common & { type: "TRANSFER"; fromLocationId: string; toLocationId: string; quantity: number })
  | (Common & { type: "ADJUSTMENT"; locationId: string; countedQuantity: number });

/** A business-rule violation that should be shown to the user. */
export class StockError extends Error {}

export type Tx = Prisma.TransactionClient;

/** Allow queued transactions to wait their turn rather than fail under load. */
export const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 };

/** Next sequential document number, e.g. nextNumber(tx, "INV") -> "INV-000042". */
export async function nextNumber(tx: Tx, prefix: string) {
  const counter = await tx.counter.upsert({
    where: { key: prefix },
    create: { key: prefix, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(6, "0")}`;
}

async function assertActiveProduct(tx: Tx, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new StockError("Product not found.");
  if (!product.active) throw new StockError(`${product.name} is archived.`);
  return product;
}

async function assertActiveLocation(tx: Tx, locationId: string) {
  const location = await tx.location.findUnique({ where: { id: locationId } });
  if (!location) throw new StockError("Location not found.");
  if (!location.active) throw new StockError(`${location.name} is archived.`);
  return location;
}

function assertPositiveInt(n: number) {
  if (!Number.isInteger(n) || n <= 0) throw new StockError("Quantity must be a whole number above zero.");
}

async function increment(tx: Tx, productId: string, locationId: string, qty: number) {
  await tx.stockLevel.upsert({
    where: { productId_locationId: { productId, locationId } },
    create: { productId, locationId, quantity: qty },
    update: { quantity: { increment: qty } },
  });
}

/** Atomically decrement, refusing to let stock go negative. */
async function decrement(tx: Tx, productId: string, locationId: string, qty: number, locationName: string) {
  const result = await tx.stockLevel.updateMany({
    where: { productId, locationId, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  if (result.count === 0) {
    const level = await tx.stockLevel.findUnique({
      where: { productId_locationId: { productId, locationId } },
    });
    throw new StockError(
      `Not enough stock at ${locationName}: ${level?.quantity ?? 0} available, ${qty} requested.`,
    );
  }
}

/**
 * Records a stock movement and updates stock levels in a single transaction.
 * Throws StockError for invalid requests (e.g. insufficient stock).
 */
export async function recordMovement(db: PrismaClient, input: MovementInput, userId: string) {
  return db.$transaction((tx) => applyMovement(tx, input, userId), TX_OPTIONS);
}

/** Links a movement to the sale or purchase order that caused it. */
export type MovementLinks = { saleId?: string; purchaseOrderId?: string };

/**
 * Applies a movement inside an existing transaction. Used by recordMovement,
 * and by sales and purchase orders so stock and documents change together.
 */
export async function applyMovement(tx: Tx, input: MovementInput, userId: string, links: MovementLinks = {}) {
  await assertActiveProduct(tx, input.productId);
  const base = {
    type: input.type,
    productId: input.productId,
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
    userId,
    saleId: links.saleId ?? null,
    purchaseOrderId: links.purchaseOrderId ?? null,
  };

  switch (input.type) {
    case "RECEIPT": {
      assertPositiveInt(input.quantity);
      await assertActiveLocation(tx, input.toLocationId);
      await increment(tx, input.productId, input.toLocationId, input.quantity);
      return tx.movement.create({
        data: { ...base, toLocationId: input.toLocationId, quantity: input.quantity },
      });
    }
    case "ISSUE": {
      assertPositiveInt(input.quantity);
      const from = await assertActiveLocation(tx, input.fromLocationId);
      await decrement(tx, input.productId, from.id, input.quantity, from.name);
      return tx.movement.create({
        data: { ...base, fromLocationId: from.id, quantity: input.quantity },
      });
    }
    case "TRANSFER": {
      assertPositiveInt(input.quantity);
      if (input.fromLocationId === input.toLocationId) {
        throw new StockError("Choose two different locations for a transfer.");
      }
      const from = await assertActiveLocation(tx, input.fromLocationId);
      const to = await assertActiveLocation(tx, input.toLocationId);
      await decrement(tx, input.productId, from.id, input.quantity, from.name);
      await increment(tx, input.productId, to.id, input.quantity);
      return tx.movement.create({
        data: { ...base, fromLocationId: from.id, toLocationId: to.id, quantity: input.quantity },
      });
    }
    case "ADJUSTMENT": {
      const counted = input.countedQuantity;
      if (!Number.isInteger(counted) || counted < 0) {
        throw new StockError("Counted quantity must be a whole number, zero or more.");
      }
      const location = await assertActiveLocation(tx, input.locationId);
      const key = { productId: input.productId, locationId: location.id };
      const current = await tx.stockLevel.findUnique({ where: { productId_locationId: key } });
      const delta = counted - (current?.quantity ?? 0);
      if (delta === 0) throw new StockError("The counted quantity matches the recorded stock; nothing to adjust.");
      await tx.stockLevel.upsert({
        where: { productId_locationId: key },
        create: { ...key, quantity: counted },
        update: { quantity: counted },
      });
      return tx.movement.create({
        data: { ...base, toLocationId: location.id, quantity: delta },
      });
    }
  }
}

export type StockStatus = "OUT" | "LOW" | "OK";

export function stockStatus(onHand: number, reorderLevel: number): StockStatus {
  if (onHand <= 0) return "OUT";
  if (reorderLevel > 0 && onHand <= reorderLevel) return "LOW";
  return "OK";
}
