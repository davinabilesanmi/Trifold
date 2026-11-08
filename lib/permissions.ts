export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Everything, including managing user accounts.",
  MANAGER: "Manage products and locations, and record stock movements.",
  STAFF: "View stock and record stock movements.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Permission checks, shared by server code and UI. */
export const can = {
  manageUsers: (role: Role) => role === "ADMIN",
  manageCatalog: (role: Role) => role === "ADMIN" || role === "MANAGER",
  recordMovements: (_role: Role) => true,
};
