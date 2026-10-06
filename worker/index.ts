import { Hono } from "hono";
import { authRoutes, requireJson } from "./auth";
import type { AppEnv } from "./auth";
import { catalogRoutes } from "./catalog";
import { userRoutes } from "./users";

// API lives under /api/*; everything else is served from static assets (wrangler.jsonc).
const app = new Hono<AppEnv>().basePath("/api");

app.use("*", requireJson);

app.get("/health", async (c) => {
  // Round-trip to D1 so a green health check proves the database binding works.
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ ok: row?.ok === 1, service: "cafe-inventory" });
});

app.route("/", authRoutes);
app.route("/admin/users", userRoutes);
app.route("/admin/catalog", catalogRoutes);

app.notFound((c) => c.json({ error: "not_found" }, 404));
app.onError((err, c) => {
  // Never log request bodies: they can contain PINs.
  console.error("unhandled", err.message);
  return c.json({ error: "server_error" }, 500);
});

export default app;
