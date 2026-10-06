---
status: active
read-when: Implementing or changing login, sessions, users, roles, PINs, or anything that checks who is signed in.
related: [../decisions/0004-pin-login.md, ../conventions/naming-lexicon.md]
updated: 2026-10-06
---

# Auth & users (design)

Why: ADR-0004. This file is the current design.

## Tables (D1)

`user`
| column | notes |
|---|---|
| `id` | ULID, opaque |
| `display_name` | shown in the name picker |
| _(roles)_ | stored in `user_role`, not on this table (see below) |
| `pin_hash`, `pin_salt` | PBKDF2-SHA256 over (PIN + `PIN_PEPPER`), base64 |
| `pin_iterations` | stored per user so it can be raised later without forcing a reset |
| `toast_employee_ref` | optional; **never the Toast PIN** |
| `active` | 0/1; inactive users can't sign in, and sessions are revoked |
| `failed_attempts`, `locked_until` | lockout after 5 failures, for 15 min |
| `created_at`, `updated_at` | ISO-8601 UTC |

`session`: `id`, `user_id`, `token_hash` (SHA-256), `created_at`, `expires_at` (+12 h), `last_seen_at`.

## Roles and permissions (ADR-0005, supersedes the single `role`)
`user_role (user_id, role)` with `role` in `general` · `shopper` · `admin`; a user holds any combination and gets the **union**. Roles bundle permissions defined in `worker/permissions.ts`; routes use `requirePermission(...)` and the client reads `permissions` from `/api/me` (`can("admin.users")`).

| Role | Permissions |
|---|---|
| General | `inventory.count`, `inventory.checkin`, `inventory.rebalance` |
| Shopper | `shopping.use`, `shopping.new_item` |
| Admin | `admin.users`, `admin.catalog`, `admin.void_any`, `admin.reports` |

Admin does not imply the others. At least one active Admin must exist. Changing roles ends that user's sessions. Migration `0003` converted existing users (volunteer → General; manager → General + Shopper; admin → all three).

## Implementation status (2026-10-06)
Built and deployed: migrations `0001`/`0002`/`0003`, `worker/crypto.ts`, `worker/auth.ts` (login, logout, `/api/me`, session middleware, role guard, per-user lockout, per-IP throttle of 30 attempts per 10 min), `worker/users.ts` (user management, needs `admin.users`), `worker/permissions.ts`, `scripts/seed-admin.ts`. Covered by `test/auth.test.ts`, `schema.test.ts`, `seed.test.ts`, `crypto.test.ts`. State-changing requests must be `application/json` (CSRF defence together with `SameSite=Lax`).
Screens built (2026-10-06): sign-in (`src/SignIn.tsx`: pick a name, then PIN with friendly lockout/throttle messages), app shell with sign out (`src/App.tsx`, hash routing: `#/`, `#/admin/users`), and **Admin > Users** (`src/AdminUsers.tsx`: add, edit name/roles/Toast ID, set PIN, deactivate/reactivate; roles as stackable checkboxes with descriptions). Home cards show only what the user's permissions allow; the API refuses the rest. Verified end to end in a real browser against a local database (wrong PIN, sign in, session survives reload, add user, volunteer sign-in, volunteer can't reach admin, deactivate removes from picker); that run is not yet an automated test in the repo.
Not built yet: locations/racks/shelves/items/vendors screens, bulk placement, Quick Inventory, shopping lists (see `stock-counting.md`).
Notes: PBKDF2 iterations are 10,000 (free-plan CPU limit); the pepper is `HMAC-SHA256(pepper, "<userId>:<pin>")` before PBKDF2, so a PIN hash is bound to its user. The last active admin cannot be disabled or demoted. Changing a role, resetting a PIN, or deactivating ends that user's sessions.

## Flows
- **Sign in:** `GET /api/login/users` (active display names only) → `POST /api/login {user_id, pin}` → sets cookie. Wrong PIN: generic error, increment the counter. All failure paths take the same time (constant-time compare, a dummy hash for unknown/locked users).
- **Every request:** cookie → hash → `session` lookup → attach the user and role. `/api/*` requires a session except the login routes.
- **Admin:** create user, set/reset PIN, change role, deactivate. Admin screens are desktop-friendly, but they also work on a phone.
- **First admin:** created once with a seed script (`npm run seed:admin`) that prompts locally for the PIN; PINs are never committed or passed as command-line arguments.

## PIN handling rules (Toast PINs are reused, ADR-0004)
- Never log a PIN, never return one in an API response, never show one in the UI after entry. Admins can set or reset a PIN but never view it.
- Request logging must redact `pin` fields.

## Secrets
- `PIN_PEPPER`: `wrangler secret put PIN_PEPPER`; locally in `.dev.vars` (gitignored). **Rotating it invalidates every PIN**, so rotation means re-issuing all PINs.
