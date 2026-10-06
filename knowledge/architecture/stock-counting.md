---
status: proposed
read-when: Designing or building items, locations, the Quick Inventory screen, stock counts, or "current stock" calculations.
related: [auth-and-users.md, ../conventions/naming-lexicon.md]
updated: 2026-10-06
---

# Stock counting & shopping lists (v1 design, draft)

Source: the user's requirements, 2026-10-06. Feature test: easy for volunteers, timely for the Cafe Manager.

## Requirements (as stated)
- Easy, guided, **1–2 tap** actions.
- **Quick Inventory** is the volunteers' primary screen. It groups every item Kristyn (Cafe Manager) needs checked **by the place it will be found**.
- An item can live in **several locations** (e.g. out in the cafe and in backstock in the closet). On item creation: "Where will I find this?" → multi-select from locations (Beverage Case, Cafe Counter, Cafe Pantry, …).
- Counting is **per location, per item**: tap the item → type a quantity on a **numerals-only keyboard** → Enter → saved → **auto-advance to the next item**.

## Data model (D1)
- `location` — `id`, `name`, `sort_order`, `active`.
- `item` — `id`, `name`, `unit_label` (e.g. "bags", "cases"), `count_mode` (`quantity` | `level`, see below), `active`, `par_level` (total across locations; **a normal field on every item**, user decision 2026-10-06; Kristyn sets them at setup. A `level`-mode item may leave it blank because its Low/Out threshold drives the list instead).
- `item_location` — `item_id`, `location_id`, `sort_order` (walking order inside that location). This is the "Where will I find this?" answer.
- `stock_count` — **append-only**: `id`, `item_id`, `location_id`, exactly one of `quantity` (integer) or `level` (`full` | `over_half` | `under_half` | `low` | `out`), `counted_by` (user id), `counted_at`. Never edited; a correction is a new count. History is the audit trail.
- **Current stock** of a `quantity` item = sum over its locations of the *latest* count per location. A `level` reading is never summed; it's shown as its label ("Over half"). "Last counted" and staleness come from the same rows.

- `vendor` — `id`, `name` (Costco.com, Chef Store, Fred Meyer, Safeway, …), `kind` (`online` | `in_store`), `sort_order`, `active`.
- `item_vendor` — `item_id`, `vendor_id`, `preference` (rank: 1 = preferred), optional `vendor_url`/`vendor_sku` later. An item can have several vendors (Coke: Costco.com, Fred Meyer, Safeway).
- `purchase` — **append-only**: `id`, `item_id`, `vendor_id`, `quantity`, `status` (`ordered` | `bought`), `by_user`, `at`. Created when someone checks an item off the shopping list.

## Shopping lists (derived, not stored)
- An item **needs replacing** when `current_stock < par_level` and no open `purchase` covers the gap. Suggested quantity = `par_level − current_stock`. Volunteers can also tap **"We're out / low"** on any item to force it onto the list.
- **View by vendor:** shows every needing item that has that vendor in `item_vendor`, so standing in Fred Meyer shows *everything she could get there*. An item appears under each of its vendors and is marked "also at: Costco.com, Safeway"; preferred-vendor items sort first.
- **Check-off:** marking an item bought/ordered creates a `purchase`; the item disappears from **all** vendor views immediately (no double buying). The next count of that item closes the loop and clears the purchase.
- Vendor view is a first-class screen: a vendor picker at the top (one tap), big check boxes, works on a phone in a store aisle.

## Count modes: quantity vs. level
Some items aren't worth counting: one case of cream cheese packets, a bulk bag, a jug. We need to know **when it's getting low**, not how many.
- **`quantity` mode (default):** type a number.
- **`level` mode:** the count card shows four big buttons instead of a keypad: **Over half · Under half · Low · Out**. One tap saves and advances (the fastest action in the app). **Full** is offered too, for "just opened a new case". A small **"Enter a number"** link on every level card switches to the keypad for that one entry (the number is stored as a quantity).
- The mode is set per item at creation (Manager/Admin) and can be changed later; history keeps whatever was recorded.
- **Shopping rule for level items:** needs replacing when the latest reading is **Low** or **Out** (a per-item threshold, default `low`; a Manager can raise it to `under_half` for items with long lead times). A typed quantity on a level item is compared to `par_level` if one is set.
- **Multiple locations:** each location has its own reading; a level item needs replacing only if *every* location is at/below the threshold (backstock Full + counter Low means refill the counter, not shop).

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
7. Should level items appear on **every** Quick Inventory pass (one tap each, my recommendation) or only when a volunteer flags them? Should level items be restricted to one location in v1?
5. **Buying unit vs. counting unit:** Coke is counted in bottles but bought in 24-packs. Do we need a pack size per vendor now, or is "suggested quantity in counting units" enough for v1?
6. Does anyone need **prices/cost** shown or tracked?
4. Is "reorder" judged on the **total across locations** (proposed) or per location?
