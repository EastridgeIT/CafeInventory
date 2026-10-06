import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { buildSeedSql } from "../scripts/seed-sql";
import { call, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

describe("seed first admin", () => {
  it("creates an admin who can sign in, and keeps the PIN out of the SQL", async () => {
    const sql = await buildSeedSql("Matt O'Brien", "246810", env.PIN_PEPPER);
    expect(sql).not.toContain("246810");
    expect(sql.split("\n")).toHaveLength(1); // D1 exec runs one statement per line
    await env.DB.exec(sql);
    const u = await env.DB.prepare("SELECT id, display_name, role FROM user").first<{ id: string; display_name: string; role: string }>();
    expect(u).toMatchObject({ display_name: "Matt O'Brien", role: "admin" });
    expect((await signIn({ id: u!.id, pin: "246810" })).res.status).toBe(200);
  });

  it("does nothing if an admin already exists", async () => {
    await env.DB.exec(await buildSeedSql("First", "1234", env.PIN_PEPPER));
    await env.DB.exec(await buildSeedSql("Second", "5678", env.PIN_PEPPER));
    const rows = await env.DB.prepare("SELECT display_name FROM user").all<{ display_name: string }>();
    expect(rows.results.map((r) => r.display_name)).toEqual(["First"]);
    expect((await call("/api/login/users").then((r) => r.json())) as object).toBeTruthy();
  });
});
