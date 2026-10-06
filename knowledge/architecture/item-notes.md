---
status: proposed
read-when: Building or changing notes on item cards, the Admin Notes review screen, or anything about note lifetime, locking, editing, or history.
related: [stock-counting.md, auth-and-users.md, scheduling-and-notifications.md]
updated: 2026-10-06
---

# Item notes (design; prototype in `design/layout-options.html`, option A card)

Source: user, 2026-10-06. Nothing is built yet.

## Requirements (as stated)
- Item cards (Quick Inventory first; also shopping, check-in, rebalance) have **Add a note**.
- The note **saves whether or not the inventory is updated or the item is skipped**.
- A note stays **visible and editable by its author for 12 hours**. Then it is **locked and removed from the card**.
- It is also **locked and removed once an admin reviews it and chooses Acknowledge** in the Admin area.
- **Note history is retained in admin.**

## Rules
- **Independent of the count.** A note is its own record. Saving a count, skipping, Reset/Undo of a count, or leaving the card never creates, changes or deletes a note. A typed note is **saved automatically** when the volunteer saves a count, taps a number or level button, skips, goes Back, or leaves the card, so it is never lost; there is also an explicit **Save note** button.
- **On the card (active):** not withdrawn, not acknowledged, and less than **12 hours since it was created** (the clock starts at creation, not at the last edit). Anyone looking at that item's card sees active notes with the author and time; **only the author can edit or remove their own** (assumed: visible to everyone so the next person sees "carton leaking"; CONFIRM). Admins never edit someone else's words.
- **Editing** replaces the text and adds a revision; the card shows "edited". **Remove** withdraws the note from the card; it stays in history.
- **Locked** = 12 hours passed, or acknowledged, or withdrawn. Locked notes leave the card for good.
- **Expired is not reviewed.** A note that left the card after 12 hours still sits in the admin **Needs review** queue until an admin acknowledges it, so nothing important disappears unseen.
- 1 to 500 characters, plain text only (escaped everywhere), attributed to the signed-in person.

## Data (D1)
- `item_note`: `id`, `item_id`, `location_id` (nullable), `source` (`count` · `shopping` · `check_in` · `rebalance`), `card_action` (what the person did on that card: `counted` · `skipped` · `none` · `moved` · `bought`), `body`, `author_id`, `created_at`, `edited_at`, `withdrawn_at`, `acknowledged_at`, `acknowledged_by`, `ack_comment` (optional).
- `item_note_revision`: `id`, `note_id`, `body`, `edited_by`, `edited_at` (the first revision is the original text). Never deleted.
- "Active on a card" is derived (`withdrawn_at IS NULL AND acknowledged_at IS NULL AND now < created_at + 12 h`), not stored, so it can't go stale.

## Admin > Notes
- **Needs review** (default): unacknowledged notes, newest first, expired ones included and marked. Each row: item, location, author, when, the text, what the author did on that card ("counted 5 bags", "skipped"), **Acknowledge** (with an optional comment) and "Acknowledge all for this item".
- **History:** every note with its revisions, status (active · expired · withdrawn · acknowledged by X at Y), filters by item, location, person, date, status. Retained indefinitely.
- A badge on the Admin home shows how many notes need review.

## Permissions (additions to ADR-0005)
`notes.add` (General and Shopper roles). `admin.notes` (Admin role): review, acknowledge, history.

## Open questions and suggestions
1. Notes visible to everyone on the card, editable only by the author (my reading)? Or visible only to the author?
2. Should Acknowledge allow a short comment back (for the history)?
3. Suggestion: email or in-app alert to Admins when a note is added (rides on the notification queue from `scheduling-and-notifications.md`).
4. Suggestion: quick tags (Damaged · Expired · Missing · Needs reorder) to make the review queue filterable.
5. Suggestion: a note on a shopping-list item could show on that item's list row ("buy the oat kind").
