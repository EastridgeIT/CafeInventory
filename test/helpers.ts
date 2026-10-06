import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { newPinRecord, nowIso, ulid } from "../worker/crypto";

const TABLES = ["purchase", "stock_count", "item_vendor", "item_location", "vendor", "item", "shelf", "rack", "location", "session", "login_throttle", "user"];

export async function resetDb() {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM ${t}`).run();
}

export async function addUser(over: { name?: string; role?: string; pin?: string; active?: number } = {}) {
  const id = ulid();
  const pin = over.pin ?? "1234";
  const rec = await newPinRecord(pin, id, env.PIN_PEPPER);
  const name = over.name ?? `User ${id.slice(-6)}`;
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO user (id, display_name, role, pin_hash, pin_salt, pin_iterations, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, name, over.role ?? "volunteer", rec.pin_hash, rec.pin_salt, rec.pin_iterations, over.active ?? 1, now, now)
    .run();
  return { id, pin, name };
}

let ipCounter = 0;
export async function call(path: string, o: { method?: string; body?: unknown; cookie?: string; ip?: string; contentType?: string | null } = {}) {
  const headers: Record<string, string> = { "cf-connecting-ip": o.ip ?? `10.0.0.${++ipCounter % 250}` };
  if (o.contentType !== null) headers["content-type"] = o.contentType ?? "application/json";
  if (o.cookie) headers.cookie = o.cookie;
  return exports.default.fetch(`http://example.com${path}`, {
    method: o.method ?? "GET",
    headers,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
}

export const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

export async function signIn(u: { id: string; pin: string }) {
  const res = await call("/api/login", { method: "POST", body: { user_id: u.id, pin: u.pin } });
  return { res, cookie: cookieOf(res) };
}
