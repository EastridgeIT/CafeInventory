---
status: proposed
read-when: Building or changing scheduled inventories, reminder emails, in-app alerts, the emailed one-tap link, or the cron job that sends them.
related: [auth-and-users.md, stock-counting.md, ../decisions/0006-scheduled-counts-and-magic-links.md]
updated: 2026-10-06
---

# Scheduling people for inventory, alerts and emailed links (design, draft)

Source: user request, 2026-10-06. **Built so far:** `user.email` (migration 0004, Admin > Users). **Everything below is design; nothing sends yet.** Decisions marked OPEN need the user.

## What the user asked for
- An **email address per user**.
- **Schedule a person for an inventory at a specific time**, which then spawns **alerts and emails**, the email carrying an **auto-login link to Quick Inventory**.

## Data (D1)
- `user.email` (done): optional, unique case-insensitive, admin-only visibility, never in the sign-in picker.
- `inventory_assignment`: `id`, `user_id` (assignee), `location_id` (null = all Quick Inventory locations), `due_at` (ISO UTC; entered and shown in **America/Los_Angeles**), `window_minutes` (default 120: how long after `due_at` it still counts as on time), `note`, `status` (`scheduled` · `started` · `completed` · `missed` · `cancelled`), `created_by`, `created_at`, `started_at`, `completed_at`, `cancelled_at/by`.
- `notification`: `id`, `assignment_id`, `recipient_user_id`, `kind` (`reminder` · `missed`, plus reminder-overdue alerts for `reminders.md`), `channel` (`email` · `in_app`), `send_at`, `status` (`pending` · `sending` · `sent` · `failed` · `cancelled`), `attempts`, `error` (short, no secrets), `sent_at`. Unique on `(assignment_id, recipient_user_id, kind, channel)` so nothing is sent twice.
- `login_link`: `id`, `user_id`, `assignment_id`, `token_hash` (SHA-256 of the token), `expires_at`, `redeemed_at`, `created_at`. The raw token exists only inside the email.
- Completion is **derived from counts**: an assignment is `completed` when every Quick Inventory item in its scope has an active count at or after `due_at − 60 min`, by **anyone** (if someone else did it, the work is done; the record shows who).

## Permissions (additions to ADR-0005)
`admin.schedule` (Admin role): create, reschedule, cancel, resend. `inventory.count` (General): sees **their own** assignments ("My inventory") and can start them.

## Flow
1. **Admin > Schedule**: pick a person (must have General and an email), a location or "All", date and time (the screen states the time zone), optional note. Saving creates the assignment and **one reminder email, on the scheduled day** (user, 2026-10-06: "too many" otherwise): at **7:00 AM** for a count due **before 4:00 PM**, at **4:00 PM** for a count due **at or after 4:00 PM** (confirmed by the user, 2026-10-06). If the assignment is saved after that moment but before the count is due, the email goes out at once. There is **no** "you've been scheduled" email, no day-before reminder and no start-time email; the person sees the assignment in the app (below).
2. **In-app alerts:** a banner on Home ("You're scheduled to count the Cafe Pantry today at 4:00 PM · Start counting") for the assignee from 1 hour before until it's done or missed. Admins see an "Overdue" list.
3. **Cron:** a Workers Cron Trigger every 5 minutes (`*/5 * * * *`, available on the free plan) runs `scheduled()`: claims due `notification` rows (`UPDATE … status='sending' WHERE status='pending' AND send_at <= now RETURNING`), sends them, marks `sent` or `failed` (retry up to 3 times with growing delay), and flips unfinished assignments past `due_at + window` to `missed`, which creates a `missed` alert for the person who scheduled it and every Admin. Safe to run twice: claiming is atomic and notifications are unique.
4. **The link** (below) takes the person into Quick Inventory for that assignment's location. Starting sets `started`; finishing the scope sets `completed`.
5. Cancel or reschedule cancels pending notifications and **revokes unredeemed links**; rescheduling issues new ones.

## The emailed link: security design (ADR-0006)
A link that logs someone in is a password in an email. These rules keep it from being worse than a PIN:
- **Token:** 256 random bits, only its hash is stored, in the path (`/go/<token>`), never logged, never in analytics.
- **Two-step redeem.** `GET /go/<token>` shows a landing page ("Hi Maria, you're scheduled to count the Cafe Pantry. **Start counting**") and does **not** consume anything. The button does `POST /api/link/redeem`. This matters because mail scanners and link previews fetch URLs automatically; a one-click login link would be used up (or abused) before the person opens it.
- **Scoped session, not a full sign-in.** The session is flagged `scope = 'assignment'` and carries **only `inventory.count`** (plus read), limited to that assignment's scope, **even if the person is also an Admin**. It can't reach admin screens, shopping, PIN changes or user data. It ends at the end of the scheduled day (Pacific time) or when the assignment is cancelled. "Sign in with my PIN" stays available for full access.
- **Valid for the scheduled day only** (user, 2026-10-06): the link works **any number of times on the scheduled day** (Pacific calendar day, so switching phones is fine) and **not at all on any other day**. The scoped session ends at the end of that day. An admin can "Resend", which invalidates older links.
- **Revoked automatically** when the user is deactivated, their email changes, or the assignment is cancelled.
- **Honest blast radius:** anyone who can read that mailbox or receives a forwarded email can record counts as that person until the window ends. Counts are attributed, undoable (Reset), and limited to the one scope. That's much smaller than exposing a PIN, which is also the person's Toast PIN.
- Redeem attempts are throttled per IP like sign-in; a bad token returns one generic "This link has expired or was already used. Ask the Cafe Manager to resend it."

## Email delivery (OPEN: provider; researched 2026-10-06)
Needs a sending service and DNS records (SPF/DKIM) for the sending domain. Expected volume is small: a few hundred emails a month (about 20 people, a handful of emails each), so every free tier below is enough. Figures are from each vendor's pricing page or the sources noted; re-check at signup.

| | Cloudflare Email Service | Resend | SMTP2GO |
|---|---|---|---|
| Free plan | **Sending to arbitrary recipients is not available on Workers Free.** Free on all plans only to **destination addresses verified in your own Cloudflare account** (each recipient must verify) | 3,000 emails/month, **100/day**, 3 domains, 30-day logs | 1,000 emails/month, about 200/day, 25/hour until a domain is verified, 5 verified senders, 5 days of history |
| Paid | **Workers Paid, $5/month**: 3,000 emails/month included, then $0.35 per 1,000 | Pro $20/month: 50,000/month, no daily cap, 10 domains | Paid tiers from about $10/month |
| Integration from the Worker | Native binding, **no API key to store**, same dashboard and DNS | HTTPS API with one secret (`EMAIL_API_KEY`) | Has an HTTPS API; its main strength is SMTP relay, which a Worker can't use easily |
| Notes | Rejected or suppressed sends don't count against the quota; delivery quota is per account per billing cycle | Simple, widely used; the daily cap matters only for bulk sends | 200/day is a higher daily cap than Resend's 100; lower monthly cap |

Sources: [Cloudflare Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [Resend pricing](https://resend.com/pricing.md), SMTP2GO's plan pages (via search; confirm at signup).

**Recommendation:** use **Resend on its free plan** now. If we move to **Workers Paid ($5/month)** anyway (it also lifts the free plan's 10 ms CPU limit that caps PIN hashing strength, and helps a future Toast sync), switch to **Cloudflare Email Service**: nothing else to sign up for, no key to rotate, 3,000 emails included. SMTP2GO has no advantage for this app. Either way, send mail through one small `sendEmail()` adapter so changing provider is a one-file change.

Whichever provider: sender `Cafe Inventory <inventory@jammin.cafe>`, reply-to the Cafe Manager, plain-text plus HTML, a big **Start counting** button and a visible fallback URL, no PINs ever in an email. If no provider is configured the system still schedules and shows in-app alerts; email is skipped and logged as `failed: not configured`.

## Time zones
Store UTC. Show and enter **America/Los_Angeles**. Use `Intl` for conversion and test across the March and November DST changes (a 4:00 PM entry must stay 4:00 PM local). Reminders at "9:00 AM the day before" mean local time.

## Decisions and remaining questions
Decided (user, 2026-10-06): the link works only on the scheduled day, repeatedly; one reminder email per count (7:00 AM for counts due before 4:00 PM, 4:00 PM for counts due at or after; confirmed); Pacific time with DST; **email provider: SMTP2GO**; a missed count alerts **the person who scheduled it plus all Admins**; **only Admins schedule**; no "I can't make it" button, calendar invites, recurring schedules (INIT-0010) or push and text alerts (INIT-0011). A single same-day email is acceptable because **this is not a scheduling tool**: the cafe already has its own scheduling system, and this only assigns and nudges a count on the day.

## Email: SMTP2GO setup (decided; not built)
- **Plan:** SMTP2GO free plan (about 1,000 emails/month, about 200/day; 25/hour until the sender domain is verified). Expected volume is far below that.
- **Integration:** the Worker calls SMTP2GO's **HTTPS API** (a Worker can't use SMTP directly) with the API key as the Worker secret `SMTP2GO_API_KEY`, through the single `sendEmail()` adapter. Confirm the exact endpoint and fields in SMTP2GO's API docs when building.
- **Sender domain:** verify `jammin.cafe` in SMTP2GO; it supplies a few DNS records (DKIM and return-path CNAMEs, DNS only, not proxied). The Cloudflare API token already has DNS Edit on that zone, so they can be added without the dashboard. Sender `Cafe Inventory <inventory@jammin.cafe>`.
- **What the user does:** create the SMTP2GO account, add the sender domain (copy its DNS records to Claude or let Claude read them), create an API key limited to sending, and store it in `.dev.vars` without pasting it into chat. Then Claude uploads it as the secret.
