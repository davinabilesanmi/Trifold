/**
 * Responsibilities an admin can give each staff member. Roles are presets of
 * these; a user whose ticks don't match a preset is shown as "Custom".
 */
export const PERMISSIONS = [
  { key: "sell", group: "Selling", label: "Make sales" },
  { key: "takePayments", group: "Selling", label: "Record customer payments" },
  { key: "manageCustomers", group: "Selling", label: "Add and edit customers" },
  { key: "overridePrices", group: "Selling", label: "Change prices on a sale" },
  { key: "giveDiscounts", group: "Selling", label: "Give discounts on sales" },
  { key: "cancelSales", group: "Selling", label: "Cancel sales (returns stock, refunds payments)" },
  { key: "viewAllSales", group: "Selling", label: "See everyone's sales (otherwise only their own)" },
  { key: "recordMovements", group: "Stock", label: "Move, issue and adjust stock" },
  { key: "manageCatalog", group: "Stock", label: "Add products, set prices and pack sizes" },
  { key: "manageLocations", group: "Stock", label: "Set up warehouses, shops and branches" },
  { key: "receivePurchases", group: "Buying", label: "Receive deliveries from suppliers" },
  { key: "managePurchasing", group: "Buying", label: "Manage suppliers, purchase orders and supplier payments" },
  { key: "openingBalances", group: "Money", label: "Enter opening balances for customers and suppliers" },
  { key: "viewReports", group: "Money", label: "See daily sales and stock reports, and money owed" },
  { key: "viewFinancials", group: "Money", label: "See income statement, balance sheet and profit" },
  { key: "manageExpenses", group: "Money", label: "Record expenses and other money in or out" },
  { key: "manageUsers", group: "Admin", label: "Add staff and assign responsibilities" },
  { key: "manageSettings", group: "Admin", label: "Change business details and invoice settings" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];

export function isPermission(v: unknown): v is Permission {
  return typeof v === "string" && (PERMISSION_KEYS as string[]).includes(v);
}

export const ROLES = ["OWNER", "SYSADMIN", "GM", "OUTLET_MANAGER", "SALES_REP"] as const;
export type Role = (typeof ROLES)[number];
export type RoleLabel = Role | "CUSTOM";

const SALES_REP: Permission[] = ["sell", "takePayments", "manageCustomers"];
const OUTLET_MANAGER: Permission[] = [...SALES_REP, "giveDiscounts", "viewAllSales", "recordMovements", "receivePurchases", "viewReports"];
const GM: Permission[] = [
  ...OUTLET_MANAGER, "overridePrices", "cancelSales", "manageCatalog", "managePurchasing", "openingBalances",
];
const SYSADMIN: Permission[] = ["manageUsers", "manageSettings", "manageLocations", "manageCatalog", "viewAllSales"];

export const ROLE_PRESETS: Record<Role, Permission[]> = {
  OWNER: [...PERMISSION_KEYS],
  SYSADMIN,
  GM,
  OUTLET_MANAGER,
  SALES_REP,
};

export const ROLE_LABELS: Record<RoleLabel, string> = {
  OWNER: "Owner",
  SYSADMIN: "Systems admin",
  GM: "General manager",
  OUTLET_MANAGER: "Outlet manager",
  SALES_REP: "Sales rep / marketer",
  CUSTOM: "Custom",
};

export const ROLE_DESCRIPTIONS: Record<RoleLabel, string> = {
  OWNER: "Everything, including financial statements, staff and settings.",
  SYSADMIN: "Sets up staff accounts, locations, products and settings.",
  GM: "Overall view of sales, stock, buying and reports. No income statement or balance sheet.",
  OUTLET_MANAGER: "Runs their outlet: sales, discounts, deliveries, stock and the outlet's daily reports.",
  SALES_REP: "Makes sales, takes payments and manages customers. Sees only their own sales.",
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
