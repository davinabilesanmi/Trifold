/** Lagos has no daylight saving, so a fixed +01:00 offset is exact. */
const OFFSET = "+01:00";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Lagos as YYYY-MM-DD. */
export function todayInLagos(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function startOfDay(date: string) {
  return new Date(`${date}T00:00:00${OFFSET}`);
}

/** Inclusive date range from YYYY-MM-DD strings, as a Prisma createdAt filter. */
export function parseDateRange(from?: string, to?: string) {
  const f = from && DATE.test(from) ? from : undefined;
  const t = to && DATE.test(to) ? to : undefined;
  const createdAt = f || t
    ? { ...(f ? { gte: startOfDay(f) } : {}), ...(t ? { lt: new Date(startOfDay(t).getTime() + 86_400_000) } : {}) }
    : undefined;
  return { from: f, to: t, createdAt };
}
