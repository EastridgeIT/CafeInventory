import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { fromB64, hashPin, nowIso, randomBytes, sha256Hex, timingSafeEqual, toB64, ulid, PIN_ITERATIONS, PIN_PATTERN } from "./crypto";

export type Role = "volunteer" | "manager" | "admin";
export type SessionUser = { id: string; display_name: string; role: Role };
export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } };

const COOKIE = "ci_session";
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const IP_WINDOW_MS = 10 * 60_000;
const IP_MAX_PER_WINDOW = 30;
const RANK: Record<Role, number> = { volunteer: 1, manager: 2, admin: 3 };

// Computed against unknown/locked users so every failure path costs about the same.
const DUMMY_SALT = new Uint8Array(16);

const jsonBody = async (c: Context) => c.req.json().catch(() => null);
const fail = (c: Context<AppEnv>, status: 400 | 401 | 403 | 404 | 409 | 415 | 429, error: string, extra: object = {}) =>
  c.json({ error, ...extra }, status);

/** Cookie auth. Cross-site form posts can't send application/json, which (with SameSite=Lax) covers CSRF. */
export const requireJson: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && !c.req.header("content-type")?.startsWith("application/json")) {
    return fail(c, 415, "json_required");
  }
  await next();
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return fail(c, 401, "not_signed_in");
  const row = await c.env.DB.prepare(
    `SELECT s.id AS sid, s.expires_at, s.last_seen_at, u.id, u.display_name, u.role
       FROM session s JOIN user u ON u.id = s.user_id
      WHERE s.token_hash = ? AND u.active = 1`,
  )
    .bind(await sha256Hex(token))
    .first<{ sid: string; expires_at: string; last_seen_at: string; id: string; display_name: string; role: Role }>();
  if (!row || row.expires_at <= nowIso()) {
    deleteCookie(c, COOKIE, { path: "/" });
    return fail(c, 401, "not_signed_in");
  }
  if (Date.now() - Date.parse(row.last_seen_at) > 60_000) {
    await c.env.DB.prepare("UPDATE session SET last_seen_at = ? WHERE id = ?").bind(nowIso(), row.sid).run();
  }
  c.set("user", { id: row.id, display_name: row.display_name, role: row.role });
  await next();
};

export const requireRole = (min: Role): MiddlewareHandler<AppEnv> => async (c, next) => {
  if (RANK[c.get("user").role] < RANK[min]) return fail(c, 403, "forbidden");
  await next();
};

export async function revokeSessions(db: D1Database, userId: string) {
  await db.prepare("DELETE FROM session WHERE user_id = ?").bind(userId).run();
}

async function throttled(c: Context<AppEnv>): Promise<boolean> {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const windowStart = new Date(Math.floor(Date.now() / IP_WINDOW_MS) * IP_WINDOW_MS).toISOString();
  const row = await c.env.DB.prepare(
    `INSERT INTO login_throttle (ip, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (ip, window_start) DO UPDATE SET count = count + 1 RETURNING count`,
  )
    .bind(ip, windowStart)
    .first<{ count: number }>();
  // Old windows are never read again; drop them opportunistically.
  await c.env.DB.prepare("DELETE FROM login_throttle WHERE window_start < ?")
    .bind(new Date(Date.now() - 2 * IP_WINDOW_MS).toISOString())
    .run();
  return (row?.count ?? 0) > IP_MAX_PER_WINDOW;
}

const loginBody = z.object({ user_id: z.string().min(1).max(40), pin: z.string().regex(PIN_PATTERN) });

export const authRoutes = new Hono<AppEnv>();

// Names for the sign-in picker. Active users only; nothing else is exposed.
authRoutes.get("/login/users", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, display_name FROM user WHERE active = 1 ORDER BY lower(display_name)").all();
  return c.json({ users: results });
});

authRoutes.post("/login", async (c) => {
  const pepper = c.env.PIN_PEPPER;
  if (!pepper) return c.json({ error: "server_misconfigured" }, 500);
  if (await throttled(c)) return fail(c, 429, "too_many_attempts", { retry_after_s: 600 });

  const parsed = loginBody.safeParse(await jsonBody(c));
  if (!parsed.success) return fail(c, 400, "invalid_request");
  const { user_id, pin } = parsed.data;

  const u = await c.env.DB.prepare(
    "SELECT id, display_name, role, pin_hash, pin_salt, pin_iterations, active, failed_attempts, locked_until FROM user WHERE id = ?",
  )
    .bind(user_id)
    .first<{ id: string; display_name: string; role: Role; pin_hash: string; pin_salt: string; pin_iterations: number; active: number; failed_attempts: number; locked_until: string | null }>();

  const usable = !!u && u.active === 1;
  const lockedNow = !!u?.locked_until && u.locked_until > nowIso();
  const computed = await hashPin(pin, user_id, usable ? fromB64(u.pin_salt) : DUMMY_SALT, usable ? u.pin_iterations : PIN_ITERATIONS, pepper);
  const ok = usable && !lockedNow && timingSafeEqual(computed, fromB64(u.pin_hash));

  if (!ok) {
    if (lockedNow && u?.locked_until) {
      return fail(c, 429, "locked", { retry_after_s: Math.max(1, Math.ceil((Date.parse(u.locked_until) - Date.now()) / 1000)) });
    }
    if (usable) {
      const fails = u.failed_attempts + 1;
      if (fails >= MAX_FAILS) {
        await c.env.DB.prepare("UPDATE user SET failed_attempts = 0, locked_until = ?, updated_at = ? WHERE id = ?")
          .bind(new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(), nowIso(), u.id)
          .run();
      } else {
        await c.env.DB.prepare("UPDATE user SET failed_attempts = ? WHERE id = ?").bind(fails, u.id).run();
      }
    }
    return fail(c, 401, "invalid_login");
  }

  const token = toB64(randomBytes(32)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE user SET failed_attempts = 0, locked_until = NULL WHERE id = ?").bind(u.id),
    c.env.DB.prepare("DELETE FROM session WHERE user_id = ? AND expires_at <= ?").bind(u.id, now),
    c.env.DB.prepare("INSERT INTO session (id, user_id, token_hash, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      ulid(),
      u.id,
      await sha256Hex(token),
      now,
      new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString(),
      now,
    ),
  ]);
  setCookie(c, COOKIE, token, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_HOURS * 3600 });
  return c.json({ user: { id: u.id, display_name: u.display_name, role: u.role } });
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM session WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => c.json({ user: c.get("user") }));
