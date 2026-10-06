import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, can, normalizeRoles, permissionsOf } from "../worker/permissions";

describe("stackable roles (ADR-0005)", () => {
  it("each role grants only its own bundle", () => {
    expect(can(["general"], "inventory.count")).toBe(true);
    expect(can(["general"], "shopping.use")).toBe(false);
    expect(can(["general"], "admin.users")).toBe(false);
    expect(can(["shopper"], "shopping.use")).toBe(true);
    expect(can(["shopper"], "inventory.count")).toBe(false);
    expect(can(["admin"], "admin.users")).toBe(true);
    expect(can(["admin"], "inventory.count")).toBe(false); // Admin does not imply General; stack them
  });

  it("stacking is the union of the roles", () => {
    const all = permissionsOf(["general", "shopper", "admin"]);
    expect(all).toEqual([...PERMISSIONS]);
    expect(permissionsOf(["general", "shopper"])).toEqual(
      expect.arrayContaining([...ROLE_PERMISSIONS.general, ...ROLE_PERMISSIONS.shopper]),
    );
    expect(permissionsOf([])).toEqual([]);
  });

  it("every permission belongs to some role, so none is unreachable", () => {
    for (const p of PERMISSIONS) expect(ROLES.some((r) => ROLE_PERMISSIONS[r].includes(p))).toBe(true);
  });

  it("normalizes: canonical order, no duplicates, unknown dropped", () => {
    expect(normalizeRoles(["shopper", "admin", "general", "shopper", "boss", ""])).toEqual(["general", "shopper", "admin"]);
  });
});
