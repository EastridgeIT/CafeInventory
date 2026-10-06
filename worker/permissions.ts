// Roles are stackable bundles of permissions; a user's abilities are the UNION of their roles (ADR-0005).
// Code checks permissions, never role names, so a role's contents can change in one place.
export const ROLES = ["general", "shopper", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "inventory.count", // Quick Inventory counts; reset your own recent actions
  "inventory.checkin", // put delivered (Undelivered) stock on shelves
  "inventory.rebalance", // move stock between places
  "shopping.use", // see shopping lists, record purchases (creates stock), add quantities and catalog items to the list
  "shopping.new_item", // create a draft item on the fly from the shopping list (an Admin completes its setup)
  "admin.users",
  "admin.catalog", // items, locations, racks, shelves, vendors, bulk placement
  "admin.void_any", // reset/undo anyone's action
  "admin.reports",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  general: ["inventory.count", "inventory.checkin", "inventory.rebalance"],
  shopper: ["shopping.use", "shopping.new_item"],
  admin: ["admin.users", "admin.catalog", "admin.void_any", "admin.reports"],
};

export const ROLE_LABEL: Record<Role, string> = { general: "General", shopper: "Shopper", admin: "Admin" };
export const ROLE_DESCRIPTION: Record<Role, string> = {
  general: "Count inventory, check in deliveries, move stock between places.",
  shopper: "Use the shopping list and record purchases.",
  admin: "Manage users, items and places, undo anyone's action, see reports.",
};

export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);
/** Canonical order, no duplicates, unknown values dropped. */
export const normalizeRoles = (v: Iterable<string>): Role[] => ROLES.filter((r) => [...v].includes(r));

export const permissionsOf = (roles: readonly Role[]): Permission[] =>
  PERMISSIONS.filter((p) => roles.some((r) => ROLE_PERMISSIONS[r].includes(p)));
export const can = (roles: readonly Role[], p: Permission): boolean => roles.some((r) => ROLE_PERMISSIONS[r].includes(p));
