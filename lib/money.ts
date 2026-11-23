export const PAYMENT_METHODS = ["CASH", "TRANSFER", "POS", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  TRANSFER: "Bank transfer",
  POS: "POS / card",
  OTHER: "Other",
  REFUND: "Refund",
};

export const PRICE_LEVELS = ["RETAIL", "WHOLESALE"] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const PRICE_LEVEL_LABELS: Record<PriceLevel, string> = {
  RETAIL: "Retail",
  WHOLESALE: "Wholesale",
};

export function isPriceLevel(v: unknown): v is PriceLevel {
  return v === "RETAIL" || v === "WHOLESALE";
}

export function priceFor(item: { priceRetailCents: number; priceWholesaleCents: number }, level: PriceLevel) {
  return level === "WHOLESALE" ? item.priceWholesaleCents : item.priceRetailCents;
}
