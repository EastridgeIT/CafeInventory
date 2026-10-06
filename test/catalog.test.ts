import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { nowIso, ulid } from "../worker/crypto";
import { addUser, call, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

const base = "/api/admin/catalog";
async function admin() {
  return (await signIn(await addUser({ roles: ["admin"] }))).cookie;
}
type Item = { id: string; name: string; unit_label: string; variants: { id: string; name: string; equals: number | null }[]; buy_variant_id: string | null; count_variant_id: string | null; needs_review: boolean };
const mkItem = async (cookie: string, body: object) => call(`${base}/items`, { method: "POST", cookie, body });
const items = async (cookie: string, qs = "") => ((await (await call(`${base}/items${qs}`, { cookie })).json()) as { items: Item[]; categories: string[] });

describe("catalog permissions", () => {
  it("needs the Admin role, however many other roles you stack", async () => {
    for (const roles of [["general"], ["shopper"], ["general", "shopper"]]) {
      const { cookie } = await signIn(await addUser({ roles }));
      expect((await call(`${base}/items`, { cookie })).status).toBe(403);
      expect((await call(`${base}/places`, { cookie })).status).toBe(403);
    }
    expect((await call(`${base}/items`)).status).toBe(401);
  });
});

describe("items", () => {
  it("creates a plain item with sensible defaults", async () => {
    const c = await admin();
    const res = await mkItem(c, { name: "Oat Milk", category: "Dairy & Chilled", unit_label: "cartons" });
    expect(res.status).toBe(201);
    const { item } = (await res.json()) as { item: Item & { measurement_method: string; in_quick_inventory: boolean } };
    expect(item).toMatchObject({ name: "Oat Milk", unit_label: "cartons", measurement_method: "whole", in_quick_inventory: true, variants: [] });
    expect(item.buy_variant_id).toBeNull();
  });

  it("creates an item with variants and defaults the preferred variants to the first", async () => {
    const c = await admin();
    const { item } = (await (await mkItem(c, { name: "Milk, Whole", unit_label: "gallons", variants: [{ name: "Gallon", equals: 1 }, { name: "Half Gallon", equals: 0.5 }] })).json()) as { item: Item };
    expect(item.variants.map((v) => v.name)).toEqual(["Gallon", "Half Gallon"]);
    expect(item.variants[1]?.equals).toBe(0.5);
    expect(item.buy_variant_id).toBe(item.variants[0]?.id);
    expect(item.count_variant_id).toBe(item.variants[0]?.id);
  });

  it("honours separate preferred buy and count variants", async () => {
    const c = await admin();
    const { item } = (await (await mkItem(c, { name: "Hot Cups, 12oz", unit_label: "sleeves", variants: [{ name: "Sleeve", equals: 1 }, { name: "Case", equals: null }], buy_variant: "Case", count_variant: "Sleeve" })).json()) as { item: Item };
    expect(item.buy_variant_id).toBe(item.variants.find((v) => v.name === "Case")?.id);
    expect(item.count_variant_id).toBe(item.variants.find((v) => v.name === "Sleeve")?.id);
    expect(item.variants.find((v) => v.name === "Case")?.equals).toBeNull(); // unknown conversion is allowed
  });

  it("rejects bad input with clear reasons", async () => {
    const c = await admin();
    const bad = async (body: object) => ((await (await mkItem(c, body)).json()) as { error: string }).error;
    expect(await bad({ name: "" })).toBe("invalid_request");
    expect(await bad({ name: "A", quick_max: 25 })).toBe("invalid_request");
    expect(await bad({ name: "B", quick_max: 4, par_level: 6 })).toBe("quick_max_below_par");
    expect(await bad({ name: "C", measurement_method: "level", quick_max: 6 })).toBe("quick_max_needs_whole");
    expect(await bad({ name: "D", variants: [{ name: "x" }, { name: "X" }] })).toBe("duplicate_variant");
    expect(await bad({ name: "E", variants: [{ name: "Gallon" }], buy_variant: "Nope" })).toBe("unknown_variant");
  });

  it("keeps item names unique, ignoring case", async () => {
    const c = await admin();
    expect((await mkItem(c, { name: "Straws (box)" })).status).toBe(201);
    const dup = await mkItem(c, { name: "straws (BOX)" });
    expect(dup.status).toBe(409);
    expect(((await dup.json()) as { error: string }).error).toBe("name_taken");
  });

  it("edits fields and replaces variants: rename, add, remove", async () => {
    const c = await admin();
    const { item } = (await (await mkItem(c, { name: "Carriers", unit_label: "each", variants: [{ name: "Each", equals: 1 }, { name: "Pack", equals: null }] })).json()) as { item: Item };
    const each = item.variants.find((v) => v.name === "Each")!;
    const res = await call(`${base}/items/${item.id}`, { method: "PATCH", cookie: c, body: { par_level: 100, variants: [{ id: each.id, name: "Loose", equals: 1 }, { name: "Sleeve", equals: 50 }], buy_variant: "Sleeve", count_variant: "Loose" } });
    expect(res.status).toBe(200);
    const upd = ((await res.json()) as { item: Item & { par_level: number } }).item;
    expect(upd.par_level).toBe(100);
    expect(upd.variants.map((v) => v.name)).toEqual(["Loose", "Sleeve"]);
    expect(upd.variants[0]?.id).toBe(each.id); // renamed in place, not recreated
    expect(upd.buy_variant_id).toBe(upd.variants[1]?.id);
    expect(upd.count_variant_id).toBe(each.id);
  });

  it("checks quick_max against par on edit using the stored values", async () => {
    const c = await admin();
    const { item } = (await (await mkItem(c, { name: "Water", quick_max: 24, par_level: 12 })).json()) as { item: Item };
    const r = await call(`${base}/items/${item.id}`, { method: "PATCH", cookie: c, body: { par_level: 30 } });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe("quick_max_below_par");
  });

  it("filters the list by search, category and needs-setup, and lists categories", async () => {
    const c = await admin();
    await mkItem(c, { name: "Syrup, Vanilla", category: "Syrups", needs_review: true });
    await mkItem(c, { name: "Syrup, Almond", category: "Syrups" });
    await mkItem(c, { name: "Bagels, Plain", category: "Bakery", needs_review: true });
    expect((await items(c)).items).toHaveLength(3);
    expect((await items(c, "?q=syrup")).items.map((i) => i.name).sort()).toEqual(["Syrup, Almond", "Syrup, Vanilla"]);
    expect((await items(c, "?category=Bakery")).items.map((i) => i.name)).toEqual(["Bagels, Plain"]);
    expect((await items(c, "?needs_review=1")).items).toHaveLength(2);
    expect((await items(c)).categories).toEqual(["Bakery", "Syrups"]);
  });

  it("hides inactive items unless asked", async () => {
    const c = await admin();
    const { item } = (await (await mkItem(c, { name: "Old thing" })).json()) as { item: Item };
    await call(`${base}/items/${item.id}`, { method: "PATCH", cookie: c, body: { active: false } });
    expect((await items(c)).items).toHaveLength(0);
    expect((await items(c, "?inactive=1")).items).toHaveLength(1);
  });
});

describe("places", () => {
  type Loc = { id: string; name: string; kind: string; racks: { id: string; name: string }[]; shelves: { id: string; name: string; rack_id: string | null }[] };
  const places = async (cookie: string) => ((await (await call(`${base}/places`, { cookie })).json()) as { locations: Loc[] }).locations;
  const post = (cookie: string, path: string, body: object) => call(`${base}${path}`, { method: "POST", cookie, body });
  const names = (l: { name: string }[]) => l.map((x) => x.name);

  it("always has the Undelivered system place, listed last and protected", async () => {
    const c = await admin();
    await post(c, "/locations", { name: "Cafe Pantry" });
    const ls = await places(c);
    expect(names(ls)).toEqual(["Cafe Pantry", "Undelivered"]);
    const u = ls[1]!;
    expect(u.kind).toBe("undelivered");
    expect((await call(`${base}/locations/${u.id}`, { method: "PATCH", cookie: c, body: { name: "Nope" } })).status).toBe(409);
    expect((await post(c, `/locations/${u.id}/racks`, { name: "Rack 1" })).status).toBe(409);
    expect((await post(c, `/locations/${u.id}/shelves`, { name: "Shelf 1" })).status).toBe(409);
  });

  it("builds a location with racks and shelves, rejects duplicate names", async () => {
    const c = await admin();
    expect((await post(c, "/locations", { name: "Cafe Pantry" })).status).toBe(201);
    expect((await post(c, "/locations", { name: "cafe pantry" })).status).toBe(409);
    const lid = (await places(c))[0]!.id;
    await post(c, `/locations/${lid}/racks`, { name: "Rack 1" });
    const rid = (await places(c))[0]!.racks[0]!.id;
    await post(c, `/locations/${lid}/shelves`, { name: "Shelf 1 (top)", rack_id: rid });
    await post(c, `/locations/${lid}/shelves`, { name: "Shelf 2", rack_id: rid });
    const loc = (await places(c))[0]!;
    expect(names(loc.shelves)).toEqual(["Shelf 1 (top)", "Shelf 2"]);
    expect(loc.shelves.every((s) => s.rack_id === rid)).toBe(true);
  });

  it("refuses a shelf on a rack from another location", async () => {
    const c = await admin();
    await post(c, "/locations", { name: "A" });
    await post(c, "/locations", { name: "B" });
    const [a, b] = await places(c);
    await post(c, `/locations/${a!.id}/racks`, { name: "Rack A" });
    const rackA = (await places(c))[0]!.racks[0]!.id;
    expect((await post(c, `/locations/${b!.id}/shelves`, { name: "S", rack_id: rackA })).status).toBe(400);
  });

  it("renames and reorders shelves, locations and racks", async () => {
    const c = await admin();
    await post(c, "/locations", { name: "A" });
    await post(c, "/locations", { name: "B" });
    const mv = (kind: string, id: string, dir: string) => post(c, `/${kind}/${id}/move`, { dir });
    let ls = await places(c);
    await mv("locations", ls[1]!.id, "up");
    expect(names(await places(c))).toEqual(["B", "A", "Undelivered"]);
    ls = await places(c);
    const lid = ls[0]!.id;
    for (const n of ["S1", "S2", "S3"]) await post(c, `/locations/${lid}/shelves`, { name: n });
    let sh = (await places(c))[0]!.shelves;
    await mv("shelves", sh[2]!.id, "up");
    expect(names((await places(c))[0]!.shelves)).toEqual(["S1", "S3", "S2"]);
    await mv("shelves", sh[0]!.id, "up"); // already first: no change
    expect(names((await places(c))[0]!.shelves)).toEqual(["S1", "S3", "S2"]);
    await call(`${base}/shelves/${sh[0]!.id}`, { method: "PATCH", cookie: c, body: { name: "Top shelf" } });
    sh = (await places(c))[0]!.shelves;
    expect(sh[0]?.name).toBe("Top shelf");
  });

  it("will not delete a rack that has shelves or a shelf that holds items", async () => {
    const c = await admin();
    await post(c, "/locations", { name: "A" });
    const lid = (await places(c))[0]!.id;
    await post(c, `/locations/${lid}/racks`, { name: "Rack" });
    const rid = (await places(c))[0]!.racks[0]!.id;
    await post(c, `/locations/${lid}/shelves`, { name: "Shelf", rack_id: rid });
    const sid = (await places(c))[0]!.shelves[0]!.id;
    expect((await call(`${base}/racks/${rid}`, { method: "DELETE", cookie: c, body: {} })).status).toBe(409);
    const item = ulid();
    await env.DB.prepare("INSERT INTO item (id, name, created_at, updated_at) VALUES (?, 'X', ?, ?)").bind(item, nowIso(), nowIso()).run();
    await env.DB.prepare("INSERT INTO item_location (item_id, location_id, shelf_id) VALUES (?, ?, ?)").bind(item, lid, sid).run();
    expect((await call(`${base}/shelves/${sid}`, { method: "DELETE", cookie: c, body: {} })).status).toBe(409);
    await env.DB.prepare("DELETE FROM item_location").run();
    expect((await call(`${base}/shelves/${sid}`, { method: "DELETE", cookie: c, body: {} })).status).toBe(200);
    expect((await call(`${base}/racks/${rid}`, { method: "DELETE", cookie: c, body: {} })).status).toBe(200);
  });
});
