---
status: proposed
read-when: Building or changing reminders (one-time or recurring tasks shown on Home), their completion, or the Admin Reminders screen.
related: [scheduling-and-notifications.md, auth-and-users.md]
updated: 2026-10-06
---

# Reminders (design; prototype `design/reminders.html`)

Source: user, 2026-10-06. Nothing is built yet.

## Requirements (as stated)
- **Reminders** that show up **at or after a specific time**, so **whoever is using the app that day** sees them and **checks a box** when complete or acknowledged.
- Examples: "Perform a Quick Inventory", "Move the bagels to the freezer".
- Some are **recurring**; some are added as **one time**.
- (Clarified: not tied to a scheduled person or "lead". Anyone using the app that day.)

## Behavior
- **Home shows all of today's reminders, including ones not yet due** (user, 2026-10-06; "No reminders due." only when the day has none). Due-and-open reminders come first and are highlighted; reminders later today are listed below, dimmed, with their time ("Due 2:00 PM") and can't be checked until due; done ones follow with who and when. (Open: allow checking early? Default no.)
- **One banner for everything open** (user, 2026-10-06): a **single, persistent banner on every screen** (not only Home), "3 reminders need attention", appears whenever at least one reminder is **past its time and not done**, links to Home, and disappears when all are done. One banner represents all of them; it can't be dismissed while any is open.
- **Admin alert after one hour** (user, 2026-10-06): if a reminder isn't completed **within one hour of its time**, an alert goes to **Admins** (everyone with the Admin role): an in-app alert (shown in Admin and as a badge) and an email once email is configured. **Once per occurrence** (`notification` unique per reminder occurrence and recipient), not repeated, and it clears itself if the reminder is then completed. For a one-time reminder that carries over, it alerts once, when it first goes an hour overdue.
- **One check completes it for everyone.** The first person to check wins (atomic update). Done reminders stay on Home for the rest of that day with "Done by Maria · 10:42 AM", then drop off.
- **Clicking a checked box again removes the check** (user, 2026-10-06). Removing **your own** check is immediate. Removing **someone else's** first asks "Remove Maria's check? They marked this done at 10:42 AM." with **Keep it** / **Remove check** (user, 2026-10-06). **Anyone** using the app can do it, and every check and uncheck is kept in an **event log** (who, when, and whose check was removed), shown in Admin history, so a mistaken or disputed uncheck is visible. The reminder then shows as open again for everyone.
- **Recurring** reminders appear only on their day (daily, selected weekdays; later every N weeks or a day of the month). If nobody checks one by the end of its day it becomes **Missed** (shown in admin history, not carried onto the next day).
- **One-time** reminders **carry over** day after day until someone checks them, labelled "From Tuesday".
- **Optional button** on a reminder opens the right screen: Quick Inventory (a chosen location), Shopping list, Check in, Rebalance, or none. The button only navigates; the box is still checked by a person (suggestion: auto-complete when a Quick Inventory pass for that location finishes).
- Times are **America/Los_Angeles** (DST-safe); stored in UTC.

## Data (D1)
- `reminder` (the definition): `id`, `title` (1 to 120), `details` (optional, 300), `kind` (`one_time` · `recurring`), `at_minutes` (minutes after local midnight), `due_date` (one-time), `weekdays` (bitmask, recurring), `action` (`none` · `quick_inventory` · `shopping` · `check_in` · `rebalance`), `action_location_id`, `active`, `starts_on`/`ends_on` (optional), `created_by`, `created_at`, `updated_at`.
- `reminder_occurrence`: `id`, `reminder_id`, `local_date`, `status` (`open` · `done` · `missed`), `completed_by`, `completed_at` (cleared on uncheck). `reminder_event` (append-only): `id`, `occurrence_id`, `type` (`checked` · `unchecked`), `by_user`, `at`, `previous_user` (whose check was removed). Unique on `(reminder_id, local_date)`. Created **lazily** the first time anyone opens Home that day (and by a daily cron as a backstop that also marks yesterday's open recurring ones `missed`).
- Checking uses `UPDATE … SET status='done' … WHERE id=? AND status='open'` and unchecking `… SET status='open' … WHERE id=? AND status='done'`, so simultaneous taps can't both win; each writes a `reminder_event`.

## Admin > Reminders
Add (title, details, one-time date or weekdays, time, optional button), edit, pause/resume, stop. **History:** every occurrence with Done by whom and when, or Missed. Everyone signed in may check a reminder (no role needed); managing them needs `admin.reminders` (Admin role).

## Relation to scheduled inventories
`scheduling-and-notifications.md` schedules a **named person** with email alerts. Reminders are for **the day's crew** and need no assignment. They can coexist: a recurring "Perform a Quick Inventory" reminder with a Quick Inventory button, plus a named assignment, is fine.

## Decisions and remaining questions
Decided: all of today's reminders show on Home; one persistent banner for open past-due ones; Admin alert one hour after the time; clicking a checked box again removes the check (confirm only for someone else's check). Time zone Pacific with DST.
Open: may a future reminder be checked early (default: no)? More recurrence later (every N weeks, a day of the month).
