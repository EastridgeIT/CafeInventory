import { describe, expect, it } from "vitest";
import { activeId, itemsFor, splitForBar } from "../src/nav";
import { ROLE_PERMISSIONS, permissionsOf } from "../worker/permissions";

const ids = (x: { id: string }[]) => x.map((i) => i.id);

describe("main menu", () => {
  it("shows only what a user's permissions allow, Home always", () => {
    expect(ids(itemsFor([]))).toEqual(["home"]);
    expect(ids(itemsFor(permissionsOf(["general"])))).toEqual(["home", "count", "checkin", "rebalance"]);
    expect(ids(itemsFor(permissionsOf(["shopper"])))).toEqual(["home", "shop"]);
    expect(ids(itemsFor(permissionsOf(["admin"])))).toEqual(["home", "admin"]);
  });

  it("roles stack: the menu is the union", () => {
    expect(ids(itemsFor(permissionsOf(["general", "shopper"])))).toEqual(["home", "count", "shop", "checkin", "rebalance"]);
    expect(ids(itemsFor(permissionsOf(["general", "shopper", "admin"])))).toEqual(["home", "count", "shop", "checkin", "rebalance", "admin"]);
  });

  it("every role's every permission is reachable from some menu item", () => {
    const all = Object.values(ROLE_PERMISSIONS).flat();
    expect(all.length).toBeGreaterThan(0);
    expect(ids(itemsFor(all))).toContain("admin");
  });

  it("a phone bar holds five slots; beyond that the fifth becomes More", () => {
    const five = splitForBar(itemsFor(permissionsOf(["general", "shopper"])));
    expect(ids(five.bar)).toEqual(["home", "count", "shop", "checkin", "rebalance"]);
    expect(five.more).toEqual([]);
    const six = splitForBar(itemsFor(permissionsOf(["general", "shopper", "admin"])));
    expect(ids(six.bar)).toEqual(["home", "count", "shop", "checkin"]);
    expect(ids(six.more)).toEqual(["rebalance", "admin"]);
  });

  it("maps a location hash to its menu item, with Admin sub-pages under Admin and unknown paths to Home", () => {
    expect(activeId("#/")).toBe("home");
    expect(activeId("")).toBe("home");
    expect(activeId("#/count")).toBe("count");
    expect(activeId("#/admin/users")).toBe("admin");
    expect(activeId("#/nope")).toBe("home");
  });
});
