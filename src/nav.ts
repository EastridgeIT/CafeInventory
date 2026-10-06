// Main menu model: pure functions, no DOM, unit-tested (test/nav.test.ts).
import type { Permission } from "../worker/permissions";

export type IconName = "home" | "count" | "shop" | "checkin" | "rebalance" | "admin";
export type NavItem = {
  id: string;
  label: string;
  hash: string;
  icon: IconName;
  /** Visible if the user has ANY of these permissions (empty = everyone signed in). */
  needs: readonly Permission[];
};

export const NAV: readonly NavItem[] = [
  { id: "home", label: "Home", hash: "#/", icon: "home", needs: [] },
  { id: "count", label: "Count", hash: "#/count", icon: "count", needs: ["inventory.count"] },
  { id: "shop", label: "Shop", hash: "#/shop", icon: "shop", needs: ["shopping.use"] },
  { id: "checkin", label: "Check in", hash: "#/checkin", icon: "checkin", needs: ["inventory.checkin"] },
  { id: "rebalance", label: "Rebalance", hash: "#/rebalance", icon: "rebalance", needs: ["inventory.rebalance"] },
  { id: "admin", label: "Admin", hash: "#/admin", icon: "admin", needs: ["admin.users", "admin.catalog", "admin.void_any", "admin.reports"] },
];

/** A phone tab bar fits five slots; with more items the fifth becomes "More". */
export const BAR_SLOTS = 5;

export const itemsFor = (perms: readonly string[]): NavItem[] =>
  NAV.filter((i) => i.needs.length === 0 || i.needs.some((p) => perms.includes(p)));

export function splitForBar(items: readonly NavItem[]): { bar: NavItem[]; more: NavItem[] } {
  if (items.length <= BAR_SLOTS) return { bar: [...items], more: [] };
  return { bar: items.slice(0, BAR_SLOTS - 1), more: items.slice(BAR_SLOTS - 1) };
}

/** Which menu item a location hash belongs to ('#/admin/users' belongs to Admin). Unknown paths fall back to Home. */
export function activeId(hash: string): string {
  const seg = hash.replace(/^#\/?/, "").split("/")[0] ?? "";
  return NAV.some((i) => i.id === seg) ? seg : "home";
}
