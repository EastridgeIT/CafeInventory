# Changelog

All notable changes to Cafe Inventory. Format: `knowledge/conventions/changelog-and-releases.md`.

Product version: `MAJOR.MINOR.PATCH.CORRECTION` (MAJOR `0` until `1.0` is declared).
Build stamp: `YYMM###` (year, month, build # within that month). Each entry carries an ISO-8601 UTC timestamp.

Change types: **Added · Changed · Fixed · Removed · Deprecated · Security**.
Category tags: `UX · Frontend · Backend · Database · API · Integrations · Design-System · Docs · Security · Performance · Infra`.

---

## Unreleased

### Added
- [Docs] Governance & knowledge canon scaffolded: router `CLAUDE.md`, `knowledge/` (conventions, templates), `Initiatives-Open.md` / `Initiatives-Complete.md`, and this changelog.
- [Infra] Hosting decision: Cloudflare at `inventory.jammin.cafe` (ADR-0002); scoped API-token setup documented; `.gitignore` excludes secrets.
- [Docs] Accepted ADR-0003 (stack: Worker + Hono + React + D1) and ADR-0004 (PIN login); auth design doc; first lexicon terms.
- [Infra] App scaffolded (Worker + Hono + React/Vite + D1, mobile-first PWA shell) and first deployed to `inventory.jammin.cafe`; `/api/health` checks the D1 binding. Build stamp `2610001`.
- [UX] Design direction chosen: option A (guided card) for volunteers, with per-item one-tap number buttons (`quick_max`) and fullness buttons; layouts prototype published as a private artifact.
- [Backend] PIN login, sessions, per-user lockout and per-IP throttle, admin user management; [Database] migrations for users, sessions and the full inventory schema (items, locations, racks, shelves, vendors, counts with void, purchases); [Security] hashed PINs with a server-side pepper; [Infra] production migrations applied, `PIN_PEPPER` secret set, first-admin seed script. 35 tests. Build stamp `2610002`.
- [UX] Typeface chosen: Public Sans (self-hosted).
- [UX] Layout prototype gains a typeface switcher (nine fonts).
- [Docs] Design: per-item "Reset this count" (void, excluded from all calculations; Admin-only audit trace).

> The first software build will be tagged **`v0.1.0.0`** when application code lands — declared by the user.
