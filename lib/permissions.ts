export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Everything, including managing user accounts.",
  MANAGER: "Manage products, prices, suppliers and purchase orders; cancel sales; view reports.",
  STAFF: "Make sales, take payments, receive deliveries and record stock movements.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Permission checks, shared by server code and UI. */
const managerUp = (role: Role) => role === "ADMIN" || role === "MANAGER";
const anyone = (_role: Role) => true;

export const can = {
  manageUsers: (role: Role) => role === "ADMIN",
  manageSettings: (role: Role) => role === "ADMIN",
  manageCatalog: managerUp,
  recordMovements: anyone,
  sell: anyone,
  manageCustomers: anyone,
  takePayments: anyone,
  /** Change a product's price on an individual sale. */
  overridePrices: managerUp,
  cancelSales: managerUp,
  managePurchasing: managerUp,
  receivePurchases: anyone,
  viewReports: managerUp,
};
