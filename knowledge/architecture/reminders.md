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
- **Appears** on Home for every signed-in person when the reminder's time arrives on its day. Before its time it is hidden (Admins see it in the list).
- **One check completes it for everyone.** The first person to check wins (atomic update). Done reminders stay on Home for the rest of that day with "Done by Maria · 10:42 AM", then drop off.
- **Clicking a checked box again removes the check** (user, 2026-10-06). **Anyone** using the app can do it, and every check and uncheck is kept in an **event log** (who, when, and whose check was removed), shown in Admin history, so a mistaken or disputed uncheck is visible. The reminder then shows as open again for everyone.
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

## Open questions and suggestions
1. Should a missed recurring reminder alert an Admin (email/in-app via the notification queue)? Default: shown in history only.
2. Should Home show a banner or badge for open reminders while someone is mid-count? Default: a card at the top of Home, and a small badge on the app header.
3. More recurrence later: every N weeks, first Monday, a day of the month.
