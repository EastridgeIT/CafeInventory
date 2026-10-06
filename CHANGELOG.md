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

> The first software build will be tagged **`v0.1.0.0`** when application code lands — declared by the user.
