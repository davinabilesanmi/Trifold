const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "NGN";
const LOCALE = "en-NG";

export function formatMoney(cents: number, { whole = false } = {}) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    ...(whole ? { maximumFractionDigits: 0, minimumFractionDigits: 0 } : {}),
  }).format(whole ? Math.round(cents / 100) : cents / 100);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/** Always shown in Lagos time, whatever time zone the server runs in. */
export function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(d);
}

/** Parses a user-entered price like "12.50" into integer cents. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.replace(/[₦,\s]/g, "");
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}
