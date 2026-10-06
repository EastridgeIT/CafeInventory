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
| `role` | `volunteer` · `manager` · `admin` |
| `pin_hash`, `pin_salt` | PBKDF2-SHA256 over (PIN + `PIN_PEPPER`), base64 |
| `pin_iterations` | stored per user so it can be raised later without forcing a reset |
| `toast_employee_ref` | optional; **never the Toast PIN** |
| `active` | 0/1; inactive users can't sign in, and sessions are revoked |
| `failed_attempts`, `locked_until` | lockout after 5 failures, for 15 min |
| `created_at`, `updated_at` | ISO-8601 UTC |

`session`: `id`, `user_id`, `token_hash` (SHA-256), `created_at`, `expires_at` (+12 h), `last_seen_at`.

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
