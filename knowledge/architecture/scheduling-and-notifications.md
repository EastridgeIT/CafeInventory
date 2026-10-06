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
- `notification`: `id`, `assignment_id`, `recipient_user_id`, `kind` (`assigned` · `reminder` · `start` · `missed`), `channel` (`email` · `in_app`), `send_at`, `status` (`pending` · `sending` · `sent` · `failed` · `cancelled`), `attempts`, `error` (short, no secrets), `sent_at`. Unique on `(assignment_id, recipient_user_id, kind, channel)` so nothing is sent twice.
- `login_link`: `id`, `user_id`, `assignment_id`, `token_hash` (SHA-256 of the token), `expires_at`, `redeemed_at`, `created_at`. The raw token exists only inside the email.
- Completion is **derived from counts**: an assignment is `completed` when every Quick Inventory item in its scope has an active count at or after `due_at − 60 min`, by **anyone** (if someone else did it, the work is done; the record shows who).

## Permissions (additions to ADR-0005)
`admin.schedule` (Admin role): create, reschedule, cancel, resend. `inventory.count` (General): sees **their own** assignments ("My inventory") and can start them.

## Flow
1. **Admin > Schedule**: pick a person (must have General and an email), a location or "All", date and time (the screen states the time zone), optional note. Saving creates the assignment and its notifications: `assigned` email **now**, a `reminder` email **the day before at 9:00 AM** (skipped if sooner), a `start` email **at the due time** with the link, and an in-app alert.
2. **In-app alerts:** a banner on Home ("You're scheduled to count the Cafe Pantry today at 4:00 PM · Start counting") for the assignee from 1 hour before until it's done or missed. Admins see an "Overdue" list.
3. **Cron:** a Workers Cron Trigger every 5 minutes (`*/5 * * * *`, available on the free plan) runs `scheduled()`: claims due `notification` rows (`UPDATE … status='sending' WHERE status='pending' AND send_at <= now RETURNING`), sends them, marks `sent` or `failed` (retry up to 3 times with growing delay), and flips unfinished assignments past `due_at + window` to `missed`, which creates a `missed` alert for the person who scheduled it and every Admin. Safe to run twice: claiming is atomic and notifications are unique.
4. **The link** (below) takes the person into Quick Inventory for that assignment's location. Starting sets `started`; finishing the scope sets `completed`.
5. Cancel or reschedule cancels pending notifications and **revokes unredeemed links**; rescheduling issues new ones.

## The emailed link: security design (ADR-0006)
A link that logs someone in is a password in an email. These rules keep it from being worse than a PIN:
- **Token:** 256 random bits, only its hash is stored, in the path (`/go/<token>`), never logged, never in analytics.
- **Two-step redeem.** `GET /go/<token>` shows a landing page ("Hi Maria, you're scheduled to count the Cafe Pantry. **Start counting**") and does **not** consume anything. The button does `POST /api/link/redeem`. This matters because mail scanners and link previews fetch URLs automatically; a one-click login link would be used up (or abused) before the person opens it.
- **Scoped session, not a full sign-in.** The session is flagged `scope = 'assignment'` and carries **only `inventory.count`** (plus read), limited to that assignment's scope, **even if the person is also an Admin**. It can't reach admin screens, shopping, PIN changes or user data. It ends at `due_at + window + 3 hours` or when the assignment finishes. "Sign in with my PIN" stays available for full access.
- **Short life, limited use:** valid from 60 minutes before `due_at` until the session end above; redeemable once per email (OPEN: allow 3 times so a person can switch phones). An admin can "Resend", which invalidates older links.
- **Revoked automatically** when the user is deactivated, their email changes, or the assignment is cancelled.
- **Honest blast radius:** anyone who can read that mailbox or receives a forwarded email can record counts as that person until the window ends. Counts are attributed, undoable (Reset), and limited to the one scope. That's much smaller than exposing a PIN, which is also the person's Toast PIN.
- Redeem attempts are throttled per IP like sign-in; a bad token returns one generic "This link has expired or was already used. Ask the Cafe Manager to resend it."

## Email delivery (OPEN: provider)
Needs a sending service and DNS records for the sending domain. Options, to confirm before building:
- **Resend** (HTTP API; free tier is about 3,000 emails a month and 100 a day; add DKIM/SPF records for `jammin.cafe` in Cloudflare DNS). My lean: simple, reliable, easy to test. API key as the Worker secret `EMAIL_API_KEY`.
- **Cloudflare's own email sending**, if it's available on this account (I'd check current availability before recommending it, since it would keep everything in one place).
- **Microsoft 365 / existing mailbox** via SMTP/Graph: possible, but needs an app registration and is heavier from a Worker.
Whichever: sender `Cafe Inventory <inventory@jammin.cafe>`, reply-to the Cafe Manager, plain-text plus HTML, a big **Start counting** button and a visible fallback URL, no PINs ever in an email. If no provider is configured the system still schedules and shows in-app alerts; email is skipped and logged as `failed: not configured`.

## Time zones
Store UTC. Show and enter **America/Los_Angeles**. Use `Intl` for conversion and test across the March and November DST changes (a 4:00 PM entry must stay 4:00 PM local). Reminders at "9:00 AM the day before" mean local time.

## Open questions
1. **Email provider** (above).
2. **Link reuse:** single use (my default) or up to 3 redemptions?
3. **Reminder defaults:** now + day-before 9 AM + at start, as proposed? Any quiet hours?
4. **Who is told when a count is missed:** the person who scheduled it plus all Admins (my default)?
5. Should scheduling be one **admin** task, or may a **Shopper/General** person schedule others? (Default: Admin only.)

## Suggestions (not yet decided)
- **"I can't make it" button** in the email and on the home banner that alerts the scheduler (and offers to pick someone else).
- **Calendar invite (.ics)** attached to the `assigned` email so it lands in the person's calendar.
- **Recurring schedules** (INIT-0010) and **push or text alerts** (INIT-0011) reuse the same `notification` queue.
