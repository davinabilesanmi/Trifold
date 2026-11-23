/**
 * Responsibilities an admin can give each staff member. Roles are presets of
 * these; a user whose ticks don't match a preset is shown as "Custom".
 */
export const PERMISSIONS = [
  { key: "sell", group: "Selling", label: "Make sales" },
  { key: "takePayments", group: "Selling", label: "Record customer payments" },
  { key: "manageCustomers", group: "Selling", label: "Add and edit customers" },
  { key: "overridePrices", group: "Selling", label: "Change prices on a sale" },
  { key: "cancelSales", group: "Selling", label: "Cancel sales (returns stock, refunds payments)" },
  { key: "recordMovements", group: "Stock", label: "Move, issue and adjust stock" },
  { key: "manageCatalog", group: "Stock", label: "Add products, set prices and pack sizes" },
  { key: "manageLocations", group: "Stock", label: "Set up warehouses, shops and branches" },
  { key: "receivePurchases", group: "Buying", label: "Receive deliveries from suppliers" },
  { key: "managePurchasing", group: "Buying", label: "Manage suppliers, purchase orders and supplier payments" },
  { key: "openingBalances", group: "Money", label: "Enter opening balances for customers and suppliers" },
  { key: "viewReports", group: "Money", label: "See reports, profit, stock value and money owed" },
  { key: "manageUsers", group: "Admin", label: "Add staff and assign responsibilities" },
  { key: "manageSettings", group: "Admin", label: "Change business details and invoice settings" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];

export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (PERMISSION_KEYS as string[]).includes(v);
}

export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];
export type RoleLabel = Role | "CUSTOM";

const STAFF: Permission[] = ["sell", "takePayments", "manageCustomers", "recordMovements", "receivePurchases"];
const MANAGER: Permission[] = [...STAFF, "overridePrices", "cancelSales", "manageCatalog", "managePurchasing", "openingBalances", "viewReports"];

export const ROLE_PRESETS: Record<Role, Permission[]> = {
  ADMIN: [...PERMISSION_KEYS],
  MANAGER,
  STAFF,
};

export const ROLE_LABELS: Record<RoleLabel, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
  CUSTOM: "Custom",
};

export const ROLE_DESCRIPTIONS: Record<RoleLabel, string> = {
  ADMIN: "Everything, including staff accounts and settings.",
  MANAGER: "Day-to-day running: prices, buying, cancellations and reports.",
  STAFF: "Sell, take payments, receive deliveries and move stock.",
  CUSTOM: "A hand-picked set of responsibilities.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Parses the comma-separated list stored on a user, ignoring unknown entries. */
export function parsePermissions(stored: string | null | undefined): Permission[] {
  return (stored ?? "").split(",").map((s) => s.trim()).filter(isPermission);
}

export function serializePermissions(perms: Iterable<Permission>) {
  const set = new Set(perms);
  return PERMISSION_KEYS.filter((k) => set.has(k)).join(",");
}

/** The preset matching exactly these permissions, or CUSTOM. */
export function roleFor(perms: Iterable<Permission>): RoleLabel {
  const s = serializePermissions(perms);
  return ROLES.find((r) => serializePermissions(ROLE_PRESETS[r]) === s) ?? "CUSTOM";
}

export function labelForRole(role: string): string {
  return role in ROLE_LABELS ? ROLE_LABELS[role as RoleLabel] : role;
}

export type PermissionHolder = { permissions: readonly Permission[] };

const check = (key: Permission) => (u: PermissionHolder) => u.permissions.includes(key);

/** Permission checks, shared by server code and UI: can.sell(user). */
export const can = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, check(k)])) as Record<Permission, (u: PermissionHolder) => boolean>;
