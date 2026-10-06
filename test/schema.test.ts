import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { nowIso, ulid } from "../worker/crypto";
import { addUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function base() {
  const u = await addUser();
  const loc = ulid();
  const item = ulid();
  await env.DB.prepare("INSERT INTO location (id, name) VALUES (?, 'Cafe Pantry')").bind(loc).run();
  await env.DB.prepare("INSERT INTO item (id, name, created_at, updated_at) VALUES (?, 'Oat milk', ?, ?)").bind(item, nowIso(), nowIso()).run();
  return { u, loc, item };
}
const count = (b: { u: { id: string }; loc: string; item: string }, quantity: number | null, level: string | null, extra = "") =>
  env.DB.prepare(`INSERT INTO stock_count (id, item_id, location_id, quantity, level, counted_by, counted_at${extra ? ", " + extra.split("=")[0] : ""}) VALUES (?, ?, ?, ?, ?, ?, ?${extra ? ", ?" : ""})`)
    .bind(...[ulid(), b.item, b.loc, quantity, level, b.u.id, nowIso(), ...(extra ? [extra.split("=")[1]] : [])])
    .run();

describe("stock_count", () => {
  it("needs exactly one of quantity or level", async () => {
    const b = await base();
    await expect(count(b, 3, null)).resolves.toBeTruthy();
    await expect(count(b, null, "low")).resolves.toBeTruthy();
    await expect(count(b, 3, "low")).rejects.toThrow();
    await expect(count(b, null, null)).rejects.toThrow();
  });

  it("rejects negative quantities and unknown levels", async () => {
    const b = await base();
    await expect(count(b, -1, null)).rejects.toThrow();
    await expect(count(b, null, "half")).rejects.toThrow();
  });

  it("allows is_minimum only on quantities", async () => {
    const b = await base();
    await expect(env.DB.prepare("INSERT INTO stock_count (id,item_id,location_id,quantity,is_minimum,counted_by,counted_at) VALUES (?,?,?,?,1,?,?)").bind(ulid(), b.item, b.loc, 6, b.u.id, nowIso()).run()).resolves.toBeTruthy();
    await expect(env.DB.prepare("INSERT INTO stock_count (id,item_id,location_id,level,is_minimum,counted_by,counted_at) VALUES (?,?,?,?,1,?,?)").bind(ulid(), b.item, b.loc, "low", b.u.id, nowIso()).run()).rejects.toThrow();
  });

  it("hides voided counts from active_stock_count (Reset behaves as if it never happened)", async () => {
    const b = await base();
    const keep = ulid();
    const gone = ulid();
    for (const [id, q] of [[keep, 4], [gone, 9]] as const) {
      await env.DB.prepare("INSERT INTO stock_count (id,item_id,location_id,quantity,counted_by,counted_at) VALUES (?,?,?,?,?,?)").bind(id, b.item, b.loc, q, b.u.id, nowIso()).run();
    }
    await env.DB.prepare("UPDATE stock_count SET voided_at = ?, voided_by = ? WHERE id = ?").bind(nowIso(), b.u.id, gone).run();
    const rows = await env.DB.prepare("SELECT id FROM active_stock_count").all<{ id: string }>();
    expect(rows.results.map((r) => r.id)).toEqual([keep]);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM stock_count").first<{ n: number }>())?.n).toBe(2);
  });

  it("requires voided_at and voided_by together", async () => {
    const b = await base();
    const id = ulid();
    await env.DB.prepare("INSERT INTO stock_count (id,item_id,location_id,quantity,counted_by,counted_at) VALUES (?,?,?,?,?,?)").bind(id, b.item, b.loc, 1, b.u.id, nowIso()).run();
    await expect(env.DB.prepare("UPDATE stock_count SET voided_at = ? WHERE id = ?").bind(nowIso(), id).run()).rejects.toThrow();
  });
});

describe("item rules", () => {
  const ins = (cols: string, vals: unknown[]) =>
    env.DB.prepare(`INSERT INTO item (id, name, ${cols}, created_at, updated_at) VALUES (?, ?, ${cols.split(",").map(() => "?").join(",")}, ?, ?)`).bind(ulid(), "x" + ulid(), ...vals, nowIso(), nowIso()).run();

  it("quick_max must be at least par_level, so 'More than X' can't hide a reorder", async () => {
    await expect(ins("quick_max, par_level", [6, 6])).resolves.toBeTruthy();
    await expect(ins("quick_max, par_level", [4, 6])).rejects.toThrow();
  });

  it("limits quick_max to 1-24 and to whole-number items", async () => {
    await expect(ins("quick_max", [25])).rejects.toThrow();
    await expect(ins("quick_max", [0])).rejects.toThrow();
    await expect(ins("measurement_method, quick_max", ["level", 6])).rejects.toThrow();
    await expect(ins("measurement_method, quick_max", ["decimal", 6])).rejects.toThrow();
  });

  it("allows an item in several locations but only once per location", async () => {
    const b = await base();
    const loc2 = ulid();
    await env.DB.prepare("INSERT INTO location (id, name) VALUES (?, 'Backstock Closet')").bind(loc2).run();
    await env.DB.prepare("INSERT INTO item_location (item_id, location_id) VALUES (?, ?)").bind(b.item, b.loc).run();
    await env.DB.prepare("INSERT INTO item_location (item_id, location_id) VALUES (?, ?)").bind(b.item, loc2).run();
    await expect(env.DB.prepare("INSERT INTO item_location (item_id, location_id) VALUES (?, ?)").bind(b.item, b.loc).run()).rejects.toThrow();
  });
});
