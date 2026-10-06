import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requirePermission, revokeSessions } from "./auth";
import type { AppEnv } from "./auth";
import { PIN_PATTERN, newPinRecord, nowIso, ulid } from "./crypto";
import { ROLES, normalizeRoles } from "./permissions";
import type { Role } from "./permissions";

// Admin-only user management. Admins can set or reset a PIN but can never read one (ADR-0004).
export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireAuth, requirePermission("admin.users"));

const roles = z.array(z.enum(ROLES)).min(1).max(ROLES.length);
const name = z.string().trim().min(1).max(60);
const toast = z.string().trim().max(60).nullable().optional();
// Empty string means "no email". Stored lower-case so the unique index is case-insensitive in practice.
const email = z.union([z.literal("").transform(() => null), z.email().max(254).transform((e) => e.toLowerCase())]).nullable().optional();
const taken = (e: unknown) => (String((e as Error)?.message).includes("user.email") || String((e as Error)?.message).includes("user_email_uq") ? "email_taken" : "name_taken");
const PUBLIC =
  "u.id, u.display_name, u.email, u.toast_employee_ref, u.active, u.created_at, u.updated_at, (SELECT group_concat(role) FROM user_role WHERE user_id = u.id) AS roles";
type Raw = { roles: string | null } & Record<string, unknown>;
const shape = (r: Raw) => ({ ...r, roles: normalizeRoles((r.roles ?? "").split(",")) });
const one = async (db: D1Database, id: string) => {
  const r = await db.prepare(`SELECT ${PUBLIC} FROM user u WHERE u.id = ?`).bind(id).first<Raw>();
  return r ? shape(r) : null;
};

userRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT ${PUBLIC} FROM user u ORDER BY lower(u.display_name)`).all<Raw>();
  return c.json({ users: results.map(shape) });
});

userRoutes.post("/", async (c) => {
  const p = z.object({ display_name: name, roles, pin: z.string().regex(PIN_PATTERN), toast_employee_ref: toast, email }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid_request" }, 400);
  const id = ulid();
  const now = nowIso();
  const rec = await newPinRecord(p.data.pin, id, c.env.PIN_PEPPER);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO user (id, display_name, pin_hash, pin_salt, pin_iterations, toast_employee_ref, email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, p.data.display_name, rec.pin_hash, rec.pin_salt, rec.pin_iterations, p.data.toast_employee_ref ?? null, p.data.email ?? null, now, now),
      ...normalizeRoles(p.data.roles).map((r) => c.env.DB.prepare("INSERT INTO user_role (user_id, role) VALUES (?, ?)").bind(id, r)),
    ]);
  } catch (e) {
    return c.json({ error: taken(e) }, 409);
  }
  return c.json({ user: await one(c.env.DB, id) }, 201);
});

// Would this change leave the app with no active admin? (Locks everyone out of user management.)
async function lastActiveAdmin(c: { env: Env }, id: string) {
  const row = await c.env.DB.prepare("SELECT count(*) AS n FROM user u JOIN user_role r ON r.user_id = u.id AND r.role = 'admin' WHERE u.active = 1 AND u.id <> ?").bind(id).first<{ n: number }>();
  return (row?.n ?? 0) === 0;
}

userRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const p = z.object({ display_name: name.optional(), roles: roles.optional(), active: z.boolean().optional(), toast_employee_ref: toast, email }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid_request" }, 400);
  const cur = await c.env.DB.prepare("SELECT active, (SELECT group_concat(role) FROM user_role WHERE user_id = user.id) AS roles FROM user WHERE id = ?").bind(id).first<{ active: number; roles: string | null }>();
  if (!cur) return c.json({ error: "not_found" }, 404);
  const curRoles = normalizeRoles((cur.roles ?? "").split(","));
  const newRoles: Role[] | null = p.data.roles ? normalizeRoles(p.data.roles) : null;
  const losesAdmin = curRoles.includes("admin") && cur.active === 1 && ((newRoles && !newRoles.includes("admin")) || p.data.active === false);
  if (losesAdmin && (await lastActiveAdmin(c, id))) return c.json({ error: "last_admin" }, 409);
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE user SET display_name = COALESCE(?, display_name), active = COALESCE(?, active),
           toast_employee_ref = CASE WHEN ? THEN ? ELSE toast_employee_ref END,
           email = CASE WHEN ? THEN ? ELSE email END, updated_at = ? WHERE id = ?`,
      ).bind(p.data.display_name ?? null, p.data.active === undefined ? null : p.data.active ? 1 : 0, p.data.toast_employee_ref === undefined ? 0 : 1, p.data.toast_employee_ref ?? null, p.data.email === undefined ? 0 : 1, p.data.email ?? null, nowIso(), id),
      ...(newRoles
        ? [
            c.env.DB.prepare("DELETE FROM user_role WHERE user_id = ?").bind(id),
            ...newRoles.map((r) => c.env.DB.prepare("INSERT INTO user_role (user_id, role) VALUES (?, ?)").bind(id, r)),
          ]
        : []),
    ]);
  } catch (e) {
    return c.json({ error: taken(e) }, 409);
  }
  if (p.data.active === false) await revokeSessions(c.env.DB, id); // disabling a user ends their sessions at once
  if (newRoles && newRoles.join() !== curRoles.join()) await revokeSessions(c.env.DB, id); // re-authenticate with the new roles
  return c.json({ user: await one(c.env.DB, id) });
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
