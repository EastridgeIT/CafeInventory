import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole, revokeSessions } from "./auth";
import type { AppEnv } from "./auth";
import { PIN_PATTERN, newPinRecord, nowIso, ulid } from "./crypto";

// Admin-only user management. Admins can set or reset a PIN but can never read one (ADR-0004).
export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireAuth, requireRole("admin"));

const role = z.enum(["volunteer", "manager", "admin"]);
const name = z.string().trim().min(1).max(60);
const toast = z.string().trim().max(60).nullable().optional();
const PUBLIC = "id, display_name, role, toast_employee_ref, active, created_at, updated_at";

userRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT ${PUBLIC} FROM user ORDER BY lower(display_name)`).all();
  return c.json({ users: results });
});

userRoutes.post("/", async (c) => {
  const p = z.object({ display_name: name, role, pin: z.string().regex(PIN_PATTERN), toast_employee_ref: toast }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid_request" }, 400);
  const id = ulid();
  const now = nowIso();
  const rec = await newPinRecord(p.data.pin, id, c.env.PIN_PEPPER);
  try {
    await c.env.DB.prepare(
      `INSERT INTO user (id, display_name, role, pin_hash, pin_salt, pin_iterations, toast_employee_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, p.data.display_name, p.data.role, rec.pin_hash, rec.pin_salt, rec.pin_iterations, p.data.toast_employee_ref ?? null, now, now)
      .run();
  } catch {
    return c.json({ error: "name_taken" }, 409);
  }
  const created = await c.env.DB.prepare(`SELECT ${PUBLIC} FROM user WHERE id = ?`).bind(id).first();
  return c.json({ user: created }, 201);
});

// Would this change leave the app with no active admin? (Locks everyone out of user management.)
async function lastActiveAdmin(c: { env: Env }, id: string) {
  const row = await c.env.DB.prepare("SELECT count(*) AS n FROM user WHERE role = 'admin' AND active = 1 AND id <> ?").bind(id).first<{ n: number }>();
  return (row?.n ?? 0) === 0;
}

userRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const p = z.object({ display_name: name.optional(), role: role.optional(), active: z.boolean().optional(), toast_employee_ref: toast }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid_request" }, 400);
  const cur = await c.env.DB.prepare("SELECT role, active FROM user WHERE id = ?").bind(id).first<{ role: string; active: number }>();
  if (!cur) return c.json({ error: "not_found" }, 404);
  const losesAdmin = cur.role === "admin" && cur.active === 1 && ((p.data.role && p.data.role !== "admin") || p.data.active === false);
  if (losesAdmin && (await lastActiveAdmin(c, id))) return c.json({ error: "last_admin" }, 409);
  try {
    await c.env.DB.prepare(
      `UPDATE user SET display_name = COALESCE(?, display_name), role = COALESCE(?, role), active = COALESCE(?, active),
         toast_employee_ref = CASE WHEN ? THEN ? ELSE toast_employee_ref END, updated_at = ? WHERE id = ?`,
    )
      .bind(p.data.display_name ?? null, p.data.role ?? null, p.data.active === undefined ? null : p.data.active ? 1 : 0, p.data.toast_employee_ref === undefined ? 0 : 1, p.data.toast_employee_ref ?? null, nowIso(), id)
      .run();
  } catch {
    return c.json({ error: "name_taken" }, 409);
  }
  if (p.data.active === false) await revokeSessions(c.env.DB, id); // disabling a user ends their sessions at once
  if (p.data.role && p.data.role !== cur.role) await revokeSessions(c.env.DB, id); // re-authenticate with the new role
  return c.json({ user: await c.env.DB.prepare(`SELECT ${PUBLIC} FROM user WHERE id = ?`).bind(id).first() });
});

userRoutes.post("/:id/pin", async (c) => {
  const id = c.req.param("id");
  const p = z.object({ pin: z.string().regex(PIN_PATTERN) }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid_request" }, 400);
  const rec = await newPinRecord(p.data.pin, id, c.env.PIN_PEPPER);
  const r = await c.env.DB.prepare(
    "UPDATE user SET pin_hash = ?, pin_salt = ?, pin_iterations = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?",
  )
    .bind(rec.pin_hash, rec.pin_salt, rec.pin_iterations, nowIso(), id)
    .run();
  if (!r.meta.changes) return c.json({ error: "not_found" }, 404);
  await revokeSessions(c.env.DB, id);
  return c.json({ ok: true });
});
