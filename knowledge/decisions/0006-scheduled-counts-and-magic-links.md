# ADR 0006 — Scheduled counts with emailed, scoped one-tap links

**Status:** Proposed · 2026-10-06 (needs the email-provider decision)
**Related:** `knowledge/architecture/scheduling-and-notifications.md`, `0004-pin-login.md`, `0005-cumulative-roles.md`

## Context
The user wants people scheduled for inventory at a specific time, with alerts and emails whose link opens Quick Inventory without signing in. People sign in with a PIN that is also their Toast PIN (ADR-0004), so a way to start counting without typing it has real value, but an emailed login link is a credential that sits in a mailbox.

## Decision
- Add `user.email` (done) and scheduling tables (`inventory_assignment`, `notification`, `login_link`).
- Deliver through a **notification queue** processed by a **Cron Trigger every 5 minutes**; claiming is atomic and notifications are unique, so retries are safe.
- The emailed link is a **two-step, scoped, short-lived** credential: landing page first (so scanners don't consume it), then a POST that creates an **assignment-scoped session** limited to `inventory.count` for that assignment, ending shortly after the window. Tokens are random, stored hashed, revoked on cancel/deactivate/email change.
- Email goes through a transactional provider chosen separately (Resend free plan recommended; Cloudflare Email Service if the account moves to Workers Paid; SMTP2GO and Microsoft 365 considered; comparison in `scheduling-and-notifications.md`).

## Consequences
- (+) Volunteers tap one link and are counting; fewer PIN entries; the PIN never travels by email.
- (+) Misuse is bounded: one scope, one time window, attributed and undoable counts.
- (−) Anyone with access to the mailbox can count as that person during the window.
- (−) A new dependency (email provider) and DNS records; cron adds a moving part that needs monitoring (failed notifications are visible to Admins).
- (−) More security surface to test: token handling, scanner behavior, scope enforcement, DST-correct times.

## Alternatives considered
- **One-click link that signs in fully** — easiest, but scanners burn it and a forwarded email would grant a full session including admin.
- **Reminders without a link** — safest, but loses the main convenience.
- **SMS or push first** — good later (INIT-0011); email is universal and needs no app install or per-person consent beyond the address.
