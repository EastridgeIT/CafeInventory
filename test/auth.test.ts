import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { addUser, call, cookieOf, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

describe("sign in", () => {
  it("lists only active users for the picker", async () => {
    await addUser({ name: "Maria" });
    await addUser({ name: "Gone", active: 0 });
    const body = (await (await call("/api/login/users")).json()) as { users: { display_name: string }[] };
    expect(body.users.map((u) => u.display_name)).toEqual(["Maria"]);
    expect(JSON.stringify(body)).not.toMatch(/pin|role/i);
  });

  it("signs in with the right PIN and sets a hardened cookie", async () => {
    const u = await addUser({ pin: "482913" });
    const { res, cookie } = await signIn(u);
    expect(res.status).toBe(200);
    const sc = res.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/Secure/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(await res.json())).not.toContain("482913");
    const me = await call("/api/me", { cookie });
    expect(me.status).toBe(200);
  });

  it("rejects a wrong PIN and an unknown user with the same generic answer", async () => {
    const u = await addUser();
    const wrong = await call("/api/login", { method: "POST", body: { user_id: u.id, pin: "9999" } });
    const unknown = await call("/api/login", { method: "POST", body: { user_id: "nobody", pin: "9999" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("rejects malformed PINs without touching the failure counter", async () => {
    const u = await addUser();
    for (const pin of ["12", "abcd", "123456789", "12 34"]) {
      expect((await call("/api/login", { method: "POST", body: { user_id: u.id, pin } })).status).toBe(400);
    }
    const row = await env.DB.prepare("SELECT failed_attempts FROM user WHERE id = ?").bind(u.id).first<{ failed_attempts: number }>();
    expect(row?.failed_attempts).toBe(0);
  });

  it("locks a user for 15 minutes after 5 wrong PINs, even for the right PIN", async () => {
    const u = await addUser({ pin: "1234" });
    for (let i = 0; i < 5; i++) expect((await call("/api/login", { method: "POST", body: { user_id: u.id, pin: "0000" } })).status).toBe(401);
    const locked = await call("/api/login", { method: "POST", body: { user_id: u.id, pin: "1234" } });
    expect(locked.status).toBe(429);
    const b = (await locked.json()) as { error: string; retry_after_s: number };
    expect(b.error).toBe("locked");
    expect(b.retry_after_s).toBeGreaterThan(14 * 60);
  });

  it("lets the user back in once the lock has passed, and resets the counter", async () => {
    const u = await addUser({ pin: "1234" });
    await env.DB.prepare("UPDATE user SET locked_until = ?, failed_attempts = 0 WHERE id = ?").bind(new Date(Date.now() - 1000).toISOString(), u.id).run();
    expect((await signIn(u)).res.status).toBe(200);
    const row = await env.DB.prepare("SELECT locked_until FROM user WHERE id = ?").bind(u.id).first<{ locked_until: string | null }>();
    expect(row?.locked_until).toBeNull();
  });

  it("refuses inactive users", async () => {
    const u = await addUser({ active: 0 });
    expect((await signIn(u)).res.status).toBe(401);
  });

  it("throttles a single IP after 30 attempts in a window", async () => {
    const u = await addUser();
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await call("/api/login", { method: "POST", ip: "203.0.113.9", body: { user_id: "nobody", pin: "0000" } })).status;
    expect(last).toBe(429);
    expect((await call("/api/login", { method: "POST", ip: "203.0.113.10", body: { user_id: u.id, pin: u.pin } })).status).toBe(200);
  });
});

describe("sessions", () => {
  it("requires a session for /api/me", async () => {
    expect((await call("/api/me")).status).toBe(401);
  });

  it("ends the session on sign out", async () => {
    const { cookie } = await signIn(await addUser());
    expect((await call("/api/logout", { method: "POST", cookie, body: {} })).status).toBe(200);
    expect((await call("/api/me", { cookie })).status).toBe(401);
  });

  it("rejects an expired session", async () => {
    const { cookie } = await signIn(await addUser());
    await env.DB.prepare("UPDATE session SET expires_at = ?").bind(new Date(Date.now() - 1000).toISOString()).run();
    expect((await call("/api/me", { cookie })).status).toBe(401);
  });

  it("stores only a hash of the session token", async () => {
    const { cookie } = await signIn(await addUser());
    const token = cookie.split("=")[1] ?? "";
    const rows = await env.DB.prepare("SELECT token_hash FROM session").all<{ token_hash: string }>();
    expect(rows.results.length).toBe(1);
    expect(rows.results[0]?.token_hash).not.toContain(token);
    expect(token.length).toBeGreaterThan(30);
  });

  it("rejects state-changing requests that are not JSON", async () => {
    const res = await call("/api/logout", { method: "POST", contentType: "application/x-www-form-urlencoded", body: {} });
    expect(res.status).toBe(415);
  });
});

describe("stored PINs", () => {
  it("never stores the PIN, and salts so equal PINs hash differently", async () => {
    const a = await addUser({ pin: "5555" });
    const b = await addUser({ pin: "5555" });
    const rows = await env.DB.prepare("SELECT id, pin_hash, pin_salt FROM user").all<{ id: string; pin_hash: string; pin_salt: string }>();
    const ha = rows.results.find((r) => r.id === a.id)!;
    const hb = rows.results.find((r) => r.id === b.id)!;
    expect(ha.pin_hash).not.toBe(hb.pin_hash);
    expect(ha.pin_hash).not.toContain("5555");
    expect(ha.pin_salt).not.toBe(hb.pin_salt);
  });
});

describe("admin: user management", () => {
  async function admin() {
    const u = await addUser({ role: "admin", name: "Boss" });
    const { cookie } = await signIn(u);
    return { u, cookie };
  }

  it("is closed to volunteers and managers", async () => {
    for (const role of ["volunteer", "manager"]) {
      const { cookie } = await signIn(await addUser({ role }));
      expect((await call("/api/admin/users", { cookie })).status).toBe(403);
    }
    expect((await call("/api/admin/users")).status).toBe(401);
  });

  it("creates a user who can sign in, and never returns PIN data", async () => {
    const { cookie } = await admin();
    const res = await call("/api/admin/users", { method: "POST", cookie, body: { display_name: "Maria", role: "volunteer", pin: "7391", toast_employee_ref: "T-204" } });
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toMatch(/7391|pin_hash|pin_salt/);
    const { user } = JSON.parse(text) as { user: { id: string } };
    expect((await signIn({ id: user.id, pin: "7391" })).res.status).toBe(200);
    const list = await (await call("/api/admin/users", { cookie })).text();
    expect(list).not.toMatch(/pin_hash|pin_salt|7391/);
  });

  it("rejects duplicate names (case-insensitive) and bad PINs", async () => {
    const { cookie } = await admin();
    const make = (name: string, pin: string) => call("/api/admin/users", { method: "POST", cookie, body: { display_name: name, role: "volunteer", pin } });
    expect((await make("Maria", "1234")).status).toBe(201);
    expect((await make("maria", "1234")).status).toBe(409);
    expect((await make("Dev", "12")).status).toBe(400);
  });

  it("deactivating a user ends their sessions immediately", async () => {
    const { cookie } = await admin();
    const v = await addUser();
    const vs = await signIn(v);
    expect((await call("/api/me", { cookie: vs.cookie })).status).toBe(200);
    expect((await call(`/api/admin/users/${v.id}`, { method: "PATCH", cookie, body: { active: false } })).status).toBe(200);
    expect((await call("/api/me", { cookie: vs.cookie })).status).toBe(401);
  });

  it("resetting a PIN ends sessions, clears a lock, and the old PIN stops working", async () => {
    const { cookie } = await admin();
    const v = await addUser({ pin: "1111" });
    const vs = await signIn(v);
    await env.DB.prepare("UPDATE user SET locked_until = ? WHERE id = ?").bind(new Date(Date.now() + 600_000).toISOString(), v.id).run();
    expect((await call(`/api/admin/users/${v.id}/pin`, { method: "POST", cookie, body: { pin: "2222" } })).status).toBe(200);
    expect((await call("/api/me", { cookie: vs.cookie })).status).toBe(401);
    expect((await signIn({ id: v.id, pin: "1111" })).res.status).toBe(401);
    expect((await signIn({ id: v.id, pin: "2222" })).res.status).toBe(200);
  });

  it("refuses to remove the last active admin", async () => {
    const { u, cookie } = await admin();
    expect((await call(`/api/admin/users/${u.id}`, { method: "PATCH", cookie, body: { active: false } })).status).toBe(409);
    expect((await call(`/api/admin/users/${u.id}`, { method: "PATCH", cookie, body: { role: "manager" } })).status).toBe(409);
    const second = await addUser({ role: "admin" });
    expect((await call(`/api/admin/users/${u.id}`, { method: "PATCH", cookie, body: { role: "manager" } })).status).toBe(200);
    expect(second.id).toBeTruthy();
  });
});

describe("cookie parsing", () => {
  it("ignores a forged cookie", async () => {
    expect((await call("/api/me", { cookie: "ci_session=not-a-real-token" })).status).toBe(401);
    expect(cookieOf(new Response())).toBe("");
  });
});
