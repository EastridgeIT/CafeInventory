import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { requireAuth, requirePermission } from "./auth";
import type { AppEnv } from "./auth";
import { nowIso, ulid } from "./crypto";

// Admin catalog: items (with variants) and places (locations, racks, shelves). Needs `admin.catalog`.
export const catalogRoutes = new Hono<AppEnv>();
catalogRoutes.use("*", requireAuth, requirePermission("admin.catalog"));

export const UNDELIVERED_ID = "UNDELIVERED";
const err = (c: Context, status: 400 | 404 | 409, error: string) => c.json({ error }, status);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/* ---------------- items ---------------- */
const variantIn = z.object({ id: z.string().max(40).optional(), name: z.string().trim().min(1).max(40), equals: z.number().positive().nullable().optional() });
const itemIn = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().max(40).nullable().optional(),
  unit_label: z.string().trim().min(1).max(30).optional(),
  measurement_method: z.enum(["whole", "decimal", "level"]).optional(),
  quick_max: z.number().int().min(1).max(24).nullable().optional(),
  par_level: z.number().min(0).nullable().optional(),
  in_quick_inventory: z.boolean().optional(),
  ask_markout: z.boolean().optional(),
  needs_review: z.boolean().optional(),
  active: z.boolean().optional(),
  variants: z.array(variantIn).max(8).optional(),
  buy_variant: z.string().trim().max(40).nullable().optional(), // by variant name
  count_variant: z.string().trim().max(40).nullable().optional(),
});

type ItemRow = Record<string, unknown> & { id: string };
async function loadItems(db: D1Database, where = "", binds: unknown[] = []) {
  const { results } = await db.prepare(`SELECT * FROM item ${where} ORDER BY lower(coalesce(category, '')), lower(name) LIMIT 1000`).bind(...binds).all<ItemRow>();
  const vs = await db.prepare("SELECT id, item_id, name, equals_base_units, sort_order FROM item_variant WHERE active = 1 ORDER BY sort_order, name").all<{ id: string; item_id: string; name: string; equals_base_units: number | null }>();
  const by = new Map<string, { id: string; name: string; equals: number | null }[]>();
  for (const v of vs.results) by.set(v.item_id, [...(by.get(v.item_id) ?? []), { id: v.id, name: v.name, equals: num(v.equals_base_units) }]);
  return results.map((r) => ({ ...r, in_quick_inventory: !!r.in_quick_inventory, ask_markout: !!r.ask_markout, needs_review: !!r.needs_review, active: !!r.active, variants: by.get(r.id) ?? [] }));
}

catalogRoutes.get("/items", async (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const cat = c.req.query("category");
  const where: string[] = [];
  const binds: unknown[] = [];
  if (c.req.query("inactive") !== "1") where.push("active = 1");
  if (c.req.query("needs_review") === "1") where.push("needs_review = 1");
  if (cat) { where.push("category = ?"); binds.push(cat); }
  if (q) { where.push("lower(name) LIKE ?"); binds.push(`%${q}%`); }
  const items = await loadItems(c.env.DB, where.length ? `WHERE ${where.join(" AND ")}` : "", binds);
  const cats = await c.env.DB.prepare("SELECT DISTINCT category FROM item WHERE category IS NOT NULL AND category <> '' ORDER BY lower(category)").all<{ category: string }>();
  return c.json({ items, categories: cats.results.map((r) => r.category) });
});

function check(d: z.infer<typeof itemIn>, cur?: { measurement_method: string; quick_max: number | null; par_level: number | null }) {
  const method = d.measurement_method ?? cur?.measurement_method ?? "whole";
  const quick = d.quick_max === undefined ? cur?.quick_max ?? null : d.quick_max;
  const par = d.par_level === undefined ? cur?.par_level ?? null : d.par_level;
  if (quick !== null && method !== "whole") return "quick_max_needs_whole";
  if (quick !== null && par !== null && quick < par) return "quick_max_below_par";
  const names = (d.variants ?? []).map((v) => v.name.toLowerCase());
  if (new Set(names).size !== names.length) return "duplicate_variant";
  for (const k of [d.buy_variant, d.count_variant]) if (k && !names.includes(k.toLowerCase()) && d.variants) return "unknown_variant";
  return null;
}

catalogRoutes.post("/items", async (c) => {
  const p = itemIn.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  const d = p.data;
  const bad = check(d);
  if (bad) return err(c, 400, bad);
  const id = ulid(), now = nowIso();
  const variants = (d.variants ?? []).map((v, i) => ({ id: ulid(), name: v.name, equals: v.equals ?? null, i }));
  const pick = (name?: string | null) => variants.find((v) => v.name.toLowerCase() === (name ?? variants[0]?.name ?? "").toLowerCase())?.id ?? null;
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO item (id, name, category, unit_label, measurement_method, quick_max, par_level, in_quick_inventory, ask_markout, needs_review, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, d.name, d.category || null, d.unit_label ?? "each", d.measurement_method ?? "whole", d.quick_max ?? null, d.par_level ?? null, d.in_quick_inventory === false ? 0 : 1, d.ask_markout ? 1 : 0, d.needs_review ? 1 : 0, d.active === false ? 0 : 1, now, now),
      ...variants.map((v) => c.env.DB.prepare("INSERT INTO item_variant (id, item_id, name, equals_base_units, sort_order) VALUES (?, ?, ?, ?, ?)").bind(v.id, id, v.name, v.equals, v.i)),
      ...(variants.length ? [c.env.DB.prepare("UPDATE item SET buy_variant_id = ?, count_variant_id = ? WHERE id = ?").bind(pick(d.buy_variant), pick(d.count_variant), id)] : []),
    ]);
  } catch {
    return err(c, 409, "name_taken");
  }
  return c.json({ item: (await loadItems(c.env.DB, "WHERE id = ?", [id]))[0] }, 201);
});

catalogRoutes.patch("/items/:id", async (c) => {
  const id = c.req.param("id");
  const p = itemIn.partial().safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  const d = p.data;
  const cur = await c.env.DB.prepare("SELECT measurement_method, quick_max, par_level FROM item WHERE id = ?").bind(id).first<{ measurement_method: string; quick_max: number | null; par_level: number | null }>();
  if (!cur) return err(c, 404, "not_found");
  const bad = check(d as z.infer<typeof itemIn>, cur);
  if (bad) return err(c, 400, bad);
  const set = (col: string, v: unknown, has: boolean) => (has ? { col, v } : null);
  const fields = [
    set("name", d.name, d.name !== undefined), set("category", d.category || null, d.category !== undefined), set("unit_label", d.unit_label, d.unit_label !== undefined),
    set("measurement_method", d.measurement_method, d.measurement_method !== undefined), set("quick_max", d.quick_max ?? null, d.quick_max !== undefined), set("par_level", d.par_level ?? null, d.par_level !== undefined),
    set("in_quick_inventory", d.in_quick_inventory ? 1 : 0, d.in_quick_inventory !== undefined), set("ask_markout", d.ask_markout ? 1 : 0, d.ask_markout !== undefined),
    set("needs_review", d.needs_review ? 1 : 0, d.needs_review !== undefined), set("active", d.active ? 1 : 0, d.active !== undefined),
  ].filter((x): x is { col: string; v: unknown } => !!x);
  const stmts: D1PreparedStatement[] = [];
  if (fields.length) stmts.push(c.env.DB.prepare(`UPDATE item SET ${fields.map((f) => f.col + " = ?").join(", ")}, updated_at = ? WHERE id = ?`).bind(...fields.map((f) => f.v), nowIso(), id));
  if (d.variants) {
    const existing = await c.env.DB.prepare("SELECT id, name FROM item_variant WHERE item_id = ?").bind(id).all<{ id: string; name: string }>();
    const keepIds = new Set(d.variants.map((v) => v.id).filter(Boolean));
    const ids: Record<string, string> = {};
    d.variants.forEach((v, i) => {
      if (v.id && existing.results.some((e) => e.id === v.id)) {
        stmts.push(c.env.DB.prepare("UPDATE item_variant SET name = ?, equals_base_units = ?, sort_order = ?, active = 1 WHERE id = ? AND item_id = ?").bind(v.name, v.equals ?? null, i, v.id, id));
        ids[v.name.toLowerCase()] = v.id;
      } else {
        const nid = ulid();
        ids[v.name.toLowerCase()] = nid;
        stmts.push(c.env.DB.prepare("INSERT INTO item_variant (id, item_id, name, equals_base_units, sort_order) VALUES (?, ?, ?, ?, ?)").bind(nid, id, v.name, v.equals ?? null, i));
      }
    });
    for (const e of existing.results) if (!keepIds.has(e.id)) stmts.push(c.env.DB.prepare("DELETE FROM item_variant WHERE id = ?").bind(e.id));
    const first = d.variants[0]?.name.toLowerCase();
    const pick = (name?: string | null) => (d.variants!.length ? ids[(name ?? first ?? "").toLowerCase()] ?? ids[first ?? ""] ?? null : null);
    stmts.push(c.env.DB.prepare("UPDATE item SET buy_variant_id = ?, count_variant_id = ? WHERE id = ?").bind(pick(d.buy_variant), pick(d.count_variant), id));
  }
  try {
    if (stmts.length) await c.env.DB.batch(stmts);
  } catch {
    return err(c, 409, "name_taken");
  }
  return c.json({ item: (await loadItems(c.env.DB, "WHERE id = ?", [id]))[0] });
});

/* ---------------- places ---------------- */
async function loadPlaces(db: D1Database) {
  const [locs, racks, shelves] = await Promise.all([
    db.prepare("SELECT id, name, sort_order, active, kind FROM location ORDER BY (kind = 'undelivered'), sort_order, lower(name)").all<{ id: string; name: string; sort_order: number; active: number; kind: string }>(),
    db.prepare("SELECT id, location_id, name, sort_order FROM rack ORDER BY sort_order, lower(name)").all<{ id: string; location_id: string; name: string; sort_order: number }>(),
    db.prepare("SELECT id, location_id, rack_id, name, sort_order FROM shelf ORDER BY sort_order, lower(name)").all<{ id: string; location_id: string; rack_id: string | null; name: string; sort_order: number }>(),
  ]);
  return locs.results.map((l) => ({ ...l, active: !!l.active, racks: racks.results.filter((r) => r.location_id === l.id), shelves: shelves.results.filter((s) => s.location_id === l.id) }));
}
catalogRoutes.get("/places", async (c) => c.json({ locations: await loadPlaces(c.env.DB) }));

const nameIn = z.object({ name: z.string().trim().min(1).max(60) });
const isSystem = async (db: D1Database, id: string) => (await db.prepare("SELECT kind FROM location WHERE id = ?").bind(id).first<{ kind: string }>())?.kind === "undelivered";
const nextOrder = async (db: D1Database, table: string, col: string, id: string) =>
  ((await db.prepare(`SELECT coalesce(max(sort_order), -1) + 1 AS n FROM ${table} WHERE ${col} = ?`).bind(id).first<{ n: number }>())?.n ?? 0);

catalogRoutes.post("/locations", async (c) => {
  const p = nameIn.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  const id = ulid();
  const n = (await c.env.DB.prepare("SELECT coalesce(max(sort_order), -1) + 1 AS n FROM location WHERE kind = 'normal'").first<{ n: number }>())?.n ?? 0;
  try { await c.env.DB.prepare("INSERT INTO location (id, name, sort_order) VALUES (?, ?, ?)").bind(id, p.data.name, n).run(); } catch { return err(c, 409, "name_taken"); }
  return c.json({ locations: await loadPlaces(c.env.DB) }, 201);
});
catalogRoutes.patch("/locations/:id", async (c) => {
  const id = c.req.param("id");
  if (await isSystem(c.env.DB, id)) return err(c, 409, "system_location");
  const p = nameIn.partial().extend({ active: z.boolean().optional() }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  try { await c.env.DB.prepare("UPDATE location SET name = COALESCE(?, name), active = COALESCE(?, active) WHERE id = ?").bind(p.data.name ?? null, p.data.active === undefined ? null : p.data.active ? 1 : 0, id).run(); } catch { return err(c, 409, "name_taken"); }
  return c.json({ locations: await loadPlaces(c.env.DB) });
});
catalogRoutes.post("/locations/:id/racks", async (c) => {
  const lid = c.req.param("id");
  if (await isSystem(c.env.DB, lid)) return err(c, 409, "system_location");
  const p = nameIn.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  if (!(await c.env.DB.prepare("SELECT 1 FROM location WHERE id = ?").bind(lid).first())) return err(c, 404, "not_found");
  await c.env.DB.prepare("INSERT INTO rack (id, location_id, name, sort_order) VALUES (?, ?, ?, ?)").bind(ulid(), lid, p.data.name, await nextOrder(c.env.DB, "rack", "location_id", lid)).run();
  return c.json({ locations: await loadPlaces(c.env.DB) }, 201);
});
catalogRoutes.post("/locations/:id/shelves", async (c) => {
  const lid = c.req.param("id");
  if (await isSystem(c.env.DB, lid)) return err(c, 409, "system_location");
  const p = nameIn.extend({ rack_id: z.string().max(40).nullable().optional() }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  if (!(await c.env.DB.prepare("SELECT 1 FROM location WHERE id = ?").bind(lid).first())) return err(c, 404, "not_found");
  if (p.data.rack_id && !(await c.env.DB.prepare("SELECT 1 FROM rack WHERE id = ? AND location_id = ?").bind(p.data.rack_id, lid).first())) return err(c, 400, "rack_not_in_location");
  await c.env.DB.prepare("INSERT INTO shelf (id, location_id, rack_id, name, sort_order) VALUES (?, ?, ?, ?, ?)").bind(ulid(), lid, p.data.rack_id ?? null, p.data.name, await nextOrder(c.env.DB, "shelf", "location_id", lid)).run();
  return c.json({ locations: await loadPlaces(c.env.DB) }, 201);
});
catalogRoutes.patch("/racks/:id", async (c) => {
  const p = nameIn.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  const r = await c.env.DB.prepare("UPDATE rack SET name = ? WHERE id = ?").bind(p.data.name, c.req.param("id")).run();
  if (!r.meta.changes) return err(c, 404, "not_found");
  return c.json({ locations: await loadPlaces(c.env.DB) });
});
catalogRoutes.patch("/shelves/:id", async (c) => {
  const p = nameIn.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  const r = await c.env.DB.prepare("UPDATE shelf SET name = ? WHERE id = ?").bind(p.data.name, c.req.param("id")).run();
  if (!r.meta.changes) return err(c, 404, "not_found");
  return c.json({ locations: await loadPlaces(c.env.DB) });
});
catalogRoutes.delete("/racks/:id", async (c) => {
  const id = c.req.param("id");
  if (await c.env.DB.prepare("SELECT 1 FROM shelf WHERE rack_id = ?").bind(id).first()) return err(c, 409, "not_empty");
  await c.env.DB.prepare("DELETE FROM rack WHERE id = ?").bind(id).run();
  return c.json({ locations: await loadPlaces(c.env.DB) });
});
catalogRoutes.delete("/shelves/:id", async (c) => {
  const id = c.req.param("id");
  if (await c.env.DB.prepare("SELECT 1 FROM item_location WHERE shelf_id = ?").bind(id).first()) return err(c, 409, "not_empty");
  await c.env.DB.prepare("DELETE FROM shelf WHERE id = ?").bind(id).run();
  return c.json({ locations: await loadPlaces(c.env.DB) });
});

// Move a location, rack or shelf one step up or down among its siblings.
const MOVE: Record<string, { table: string; scope: string; extra?: string }> = {
  locations: { table: "location", scope: "kind = 'normal'" },
  racks: { table: "rack", scope: "location_id = (SELECT location_id FROM rack WHERE id = ?)" },
  shelves: { table: "shelf", scope: "location_id = (SELECT location_id FROM shelf WHERE id = ?)" },
};
catalogRoutes.post("/:kind{locations|racks|shelves}/:id/move", async (c) => {
  const m = MOVE[c.req.param("kind")]!;
  const id = c.req.param("id");
  const p = z.object({ dir: z.enum(["up", "down"]) }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return err(c, 400, "invalid_request");
  const sib = await c.env.DB.prepare(`SELECT id FROM ${m.table} WHERE ${m.scope} ORDER BY sort_order, lower(name)`).bind(...(m.scope.includes("?") ? [id] : [])).all<{ id: string }>();
  const ids = sib.results.map((r) => r.id);
  const i = ids.indexOf(id);
  if (i < 0) return err(c, 404, "not_found");
  const j = p.data.dir === "up" ? i - 1 : i + 1;
  if (j >= 0 && j < ids.length) {
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await c.env.DB.batch(ids.map((x, n) => c.env.DB.prepare(`UPDATE ${m.table} SET sort_order = ? WHERE id = ?`).bind(n, x)));
  }
  return c.json({ locations: await loadPlaces(c.env.DB) });
});
