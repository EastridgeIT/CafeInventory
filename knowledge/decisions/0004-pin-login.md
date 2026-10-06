# ADR 0004 — Volunteer login: pre-created users with a 4–8 digit PIN

**Status:** Accepted · 2026-10-06
**Related:** `knowledge/architecture/auth-and-users.md`, `0003-stack.md`

## Context
Volunteers must sign in with near-zero friction (feature test: ease of use drives adoption). The user (admin) will **pre-create every user** and assign each a 4–8 digit PIN **based on their Toast POS login**. There is no self sign-up, no email, and no passwords. The app is on the public internet, and a 4-digit PIN has only 10,000 possibilities.

## Decision
- **Users live in D1**, created and managed only by an admin. Roles are stackable (see ADR-0005, which replaced the original single `volunteer`/`manager`/`admin` role).
- **Login = choose your name, then enter your PIN.** PINs don't need to be unique. A PIN alone never identifies a user.
- **PIN = the person's Toast POS PIN** (user's decision, 2026-10-06; risk accepted, see Consequences).
- **PINs are never stored readable:** PBKDF2-SHA256 (WebCrypto) with a per-user random salt **plus a server-side pepper** held as a Worker secret (`PIN_PEPPER`), never in D1.
- **Brute-force limits:** 5 wrong PINs locks that user for 15 minutes (counted in D1); a per-IP rate limit on `/api/login` (Workers Rate Limiting binding or a WAF rule).
- **Sessions:** random 256-bit token in an `HttpOnly; Secure; SameSite=Lax` cookie; only its SHA-256 hash is stored in D1. 12-hour absolute expiry, a visible **Sign out**, and disabling a user ends their sessions immediately.
- **Every write is attributed** to the signed-in user (who counted, who received) for the Cafe Manager's audit trail.

## Consequences
- (+) Signing in takes about 3 seconds on a phone. Nothing to remember beyond a number volunteers already know.
- (+) A leaked D1 export does not reveal PINs: without the pepper, offline guessing is useless.
- (−) **Reusing Toast PINs ties the two systems together.** If this app's pepper *and* database both leak, Toast PINs are exposed, and a Toast PIN can authorize sales or cash actions. See the open question below.
- (−) Lockout lets someone deliberately lock out a named volunteer for 15 minutes. That's an acceptable nuisance at cafe scale.
- (−) PBKDF2 cost must fit Workers CPU limits (10 ms/request on the free plan). Iterations get tuned by measurement; Workers Paid ($5/mo) allows a stronger setting.

## Resolved questions (2026-10-06)
1. **Same PIN as Toast?** **Yes**, by the user's choice. The recommended alternative (a different PIN of the same shape) was declined. The risk is accepted: a leak of *both* the D1 data and `PIN_PEPPER` would expose Toast PINs. Mitigations are mandatory: the pepper exists only as a Worker secret and in local `.dev.vars`; PINs are never logged, never echoed back, and never shown in admin screens (admins can set or reset a PIN, never view one).
2. **Toast employee ID?** Yes: optional `toast_employee_ref` (an identifier, never the PIN).
3. **Plan:** Workers **free** plan. PBKDF2 iterations are set to fit the 10 ms CPU limit (measured at implementation, roughly 10k). The pepper, not the iteration count, is the main protection; raise iterations per user if the plan is upgraded.

## Alternatives considered
- **PIN only (no name)** — fastest, but every valid PIN becomes a target: with 20 users and 4-digit PINs, each random guess has a 1-in-500 chance of getting in.
- **Cloudflare Access (email one-time PIN)** — strongest and needs no code, but email codes in the stockroom fail the ease-of-use test.
- **Restrict access to the cafe's IP address** — strong, but breaks for volunteers on cellular data; possible later as an extra layer for admin actions.
