# ADR 0003 — Application stack: one Cloudflare Worker, Hono + React, D1

**Status:** Accepted · 2026-10-06
**Related:** `0002-host-on-cloudflare.md`, `0004-pin-login.md`, `knowledge/architecture/hosting-and-deployment.md`

## Context
Cafe Inventory runs on Cloudflare (ADR-0002). Volunteers mostly use phones at the counter or in the stockroom; the Cafe Manager also works at a desktop (reorder lists, reports). The UI must be **mobile-first but clean on desktop**. Volunteer count is small, and data is relational (items, counts, deliveries, users). Few dependencies and low upkeep matter more than raw flexibility.

## Decision
- **One Worker serves everything:** the API (under `/api/*`) and the built frontend as static assets. One deploy, one domain (`inventory.jammin.cafe`), no CORS.
- **Language:** TypeScript (strict) throughout.
- **API:** [Hono](https://hono.dev) running on Workers, with request validation via `zod`.
- **Frontend:** React single-page app built with Vite (`@cloudflare/vite-plugin`). Mobile-first CSS: single-column layout with large touch targets as the base, plus breakpoints that widen to multi-column layouts and tables on desktop. Installable as a PWA (home-screen icon, full-screen).
- **Database:** Cloudflare D1. Plain-SQL migrations in `migrations/`, applied with `wrangler d1 migrations apply`; no ORM to start.
- **Tests:** Vitest with `@cloudflare/vitest-pool-workers` (runs against a real local D1).
- **Package manager:** npm.

## Consequences
- (+) Single deploy unit and a single codebase language; the free tier covers the expected load.
- (+) React has the broadest ecosystem and the most help available; Hono is small and built for Workers.
- (+) Plain SQL keeps the schema transparent and avoids ORM churn.
- (−) Workers runtime: no long-running processes and no Node native modules; the **free plan allows 10 ms CPU per request**, which constrains PIN hashing (see ADR-0004). The $5/mo Workers Paid plan removes that limit. **Chosen: the free plan** (2026-10-06); upgrade if CPU limits bite (e.g. Toast sync).
- (−) Without an ORM there are no generated types; we hand-write row types next to the queries.
- (−) An SPA means more JavaScript on old phones than a server-rendered page would ship. Keep the bundle lean.

## Alternatives considered
- **Server-rendered (Hono JSX + htmx)** — lighter on phones, but awkward for interactive count screens and any future offline mode.
- **Svelte/SvelteKit** — smaller bundles, but a smaller ecosystem; React's familiarity wins for a long-lived volunteer project.
- **Drizzle ORM** — typed queries, but an extra layer and an extra migration tool to keep in sync. Revisit if hand-written queries become painful.
- **Cloudflare Pages + separate Worker** — Workers with static assets is now Cloudflare's recommended path and avoids a split deploy.
