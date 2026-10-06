import { Hono } from "hono";

// API lives under /api/*; everything else is served from static assets (wrangler.jsonc).
const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.get("/health", async (c) => {
  // Round-trip to D1 so a green health check proves the database binding works.
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ ok: row?.ok === 1, service: "cafe-inventory" });
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
