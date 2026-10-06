---
status: proposed
read-when: Designing or building items, locations, the Quick Inventory screen, stock counts, or "current stock" calculations.
related: [auth-and-users.md, ../conventions/naming-lexicon.md]
updated: 2026-10-06
---

# Stock counting (v1 design, draft)

Source: the user's requirements, 2026-10-06. Feature test: easy for volunteers, timely for the Cafe Manager.

## Requirements (as stated)
- Easy, guided, **1–2 tap** actions.
- **Quick Inventory** is the volunteers' primary screen. It groups every item Kristyn (Cafe Manager) needs checked **by the place it will be found**.
- An item can live in **several locations** (e.g. out in the cafe and in backstock in the closet). On item creation: "Where will I find this?" → multi-select from locations (Beverage Case, Cafe Counter, Cafe Pantry, …).
- Counting is **per location, per item**: tap the item → type a quantity on a **numerals-only keyboard** → Enter → saved → **auto-advance to the next item**.

## Data model (D1)
- `location` — `id`, `name`, `sort_order`, `active`.
- `item` — `id`, `name`, `unit_label` (e.g. "bags", "cases"), `active`, optional `par_level` (total across locations), `supplier` later.
- `item_location` — `item_id`, `location_id`, `sort_order` (walking order inside that location). This is the "Where will I find this?" answer.
- `stock_count` — **append-only**: `id`, `item_id`, `location_id`, `quantity`, `counted_by` (user id), `counted_at`. Never edited; a correction is a new count. History is the audit trail.
- **Current stock** of an item = sum over its locations of the *latest* count per location. "Last counted" and staleness come from the same rows.

## Quick Inventory behavior
1. Pick a **location** (big list/tabs, each showing "x of y counted" and when it was last done).
2. Items for that location appear in walking order. Tapping one opens a **count card**: item name, unit, last count as a hint ("last: 6 · 3 days ago"), and a numeric input.
3. Input uses `inputmode="numeric"` so phones show a numbers-only pad; **Enter** (or the big Save button) saves and moves to the next uncounted item. On desktop it's keyboard-only: type, Enter, type, Enter.
4. **Skip** and **Back** are one tap; a finished location shows a summary. No count is recorded for a skipped item.
5. **Typo guard:** a count far from the last one (e.g. 10× or 0 when last was 12) asks "Is that right?" before saving.
6. A saved count shows a brief **Undo**.

## Open questions
1. Are quantities **whole numbers** only, or do some items need halves (half a bag)? (Whole = numeric pad; fractions need a decimal pad.)
2. Does *every* item belong in Quick Inventory, or can items be flagged "don't check routinely"?
3. Who creates items and locations: Manager only, or Admin too? (Proposed: Manager and Admin.)
4. Is "reorder" judged on the **total across locations** (proposed) or per location?
