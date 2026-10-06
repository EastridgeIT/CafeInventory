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
- [Frontend] Sign-in screen (name picker + PIN), app shell with sign out, Admin > Users screen (add, edit, set PIN, deactivate); [UX] app icon and theme color moved to the chosen blue. First admin created in production. Build stamp `2610003`.
- [Docs] Design: buy by quantity, Undelivered location, Check in and Rebalance flows, stock-movement ledger, derived balances (prototype `design/stock-flows.html`). Stock-movement schema pending as a later migration.
- [Backend] Stackable cumulative roles (General, Shopper, Admin) replace the single role; permission-based checks; [Database] migration 0003; [Frontend] role checkboxes in Admin > Users and permission-driven home cards. ADR-0005. 42 tests. Build stamp `2610004`.
- [Backend] Email address per user (migration 0004, Admin > Users); [Docs] design for shopping-list additions (more quantity, catalog picker, new item on the spot) and for scheduled inventories with alerts, emails and a scoped emailed link (ADR-0006, proposed). Build stamp `2610005`.
- [Docs] Design: shelf map editor (prototype), notes on item cards (12-hour edit window, admin acknowledge, history), and reminders (one-time and recurring, shown to whoever is using the app); prototypes for each.
- [Frontend] Main menu: bottom tab bar on phones (More sheet beyond five items), side menu on desktop, items shown by permission; placeholder pages for Count, Shop, Check in, Rebalance and an Admin hub. 50 tests. [Docs] Email provider comparison (Cloudflare Email Service vs Resend vs SMTP2GO). Build stamp `2610006`.
- [UX] Home is the reminders screen ("No reminders due." for now); shortcut cards removed since the menu covers them.
- [UX] Design: shelf map scrolls by default with an explicit Rearrange mode (drag or tap-to-place); reminders toggle off when the box is clicked again (a confirm prompt only when it is someone else's check), with an event log.
- [UX] Shopping list store filter is a dropdown (with item counts) instead of pills.
- [UX] Typeface chosen: Public Sans (self-hosted).
- [UX] Layout prototype gains a typeface switcher (nine fonts).
- [Docs] Design: per-item "Reset this count" (void, excluded from all calculations; Admin-only audit trace).

> The first software build will be tagged **`v0.1.0.0`** when application code lands — declared by the user.
