const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "GBP";

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: CURRENCY }).format(cents / 100);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-GB").format(n);
}

export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Parses a user-entered price like "12.50" into integer cents. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}
