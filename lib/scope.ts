import type { Prisma } from "@prisma/client";
import { can, type PermissionHolder } from "./permissions";

/** Who is looking: their responsibilities and the locations they work at (empty = all). */
export type Viewer = PermissionHolder & { id: string; locationIds: string[] };

export function isRestricted(v: Viewer) {
  return v.locationIds.length > 0;
}

export function canUseLocation(v: Viewer, locationId: string | null | undefined) {
  return !isRestricted(v) || (!!locationId && v.locationIds.includes(locationId));
}

/** Prisma filter for locations the viewer may work with. */
export function locationWhere(v: Viewer): Prisma.LocationWhereInput {
  return isRestricted(v) ? { id: { in: v.locationIds } } : {};
}

/**
 * Sales the viewer may see: only their own without "see everyone's sales",
 * and only at their locations if they are tied to some.
 * Opening balances (no location) are visible to unrestricted viewers.
 */
export function saleWhere(v: Viewer): Prisma.SaleWhereInput {
  const and: Prisma.SaleWhereInput[] = [];
  if (!can.viewAllSales(v)) and.push({ userId: v.id });
  if (isRestricted(v)) and.push({ OR: [{ locationId: { in: v.locationIds } }, { locationId: null, userId: v.id }] });
  return and.length ? { AND: and } : {};
}

export function canSeeSale(v: Viewer, sale: { userId: string; locationId: string | null }) {
  if (!can.viewAllSales(v) && sale.userId !== v.id) return false;
  if (isRestricted(v) && !(sale.locationId ? v.locationIds.includes(sale.locationId) : sale.userId === v.id)) return false;
  return true;
}
