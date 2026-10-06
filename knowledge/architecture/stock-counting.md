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
- `rack` — optional subdivision of a location: `id`, `location_id`, `name` (e.g. "Rack 2"), `sort_order`.
- `shelf` — `id`, `location_id`, `rack_id` (null for locations without racks, like a beverage case), `name` (e.g. "Shelf 1 (top)"), `sort_order` (top to bottom).
- `item` — `id`, `name`, `unit_label` (e.g. "bags", "cases"), `measurement_method` (`whole` default | `decimal` | `level`, see below), `in_quick_inventory` (checkbox, default on), `active`, `par_level` (total across locations; **a normal field on every item**, user decision 2026-10-06; Kristyn sets them at setup. A `level`-mode item may leave it blank because its Low/Out threshold drives the list instead).
- `item_location` — `item_id`, `location_id`, optional `shelf_id`, `position` (order within the shelf). This is the "Where will I find this?" answer, down to the shelf for items where that matters.
- `stock_count` — **append-only**: `id`, `item_id`, `location_id`, exactly one of `quantity` (whole by default; fractional only for `decimal` items) or `level` (`full` | `over_half` | `under_half` | `low` | `out`), `counted_by` (user id), `counted_at`. Never edited; a correction is a new count. History is the audit trail.
- **Current stock** of a `quantity` item = sum over its locations of the *latest* count per location. A `level` reading is never summed; it's shown as its label ("Over half"). "Last counted" and staleness come from the same rows.

- `vendor` — `id`, `name` (Costco.com, Chef Store, Fred Meyer, Safeway, …), `kind` (`online` | `in_store`), `sort_order`, `active`.
- `item_vendor` — `item_id`, `vendor_id`, `preference` (rank: 1 = preferred), optional `vendor_url`/`vendor_sku` later. An item can have several vendors (Coke: Costco.com, Fred Meyer, Safeway).
- `purchase` — **append-only**: `id`, `item_id`, `vendor_id`, `quantity`, `status` (`ordered` | `bought`), `by_user`, `at`. Created when someone checks an item off the shopping list.

## Shopping lists (derived, not stored)
- An item **needs replacing** when `current_stock < par_level` and no open `purchase` covers the gap. Suggested quantity = `par_level − current_stock`. Volunteers can also tap **"We're out / low"** on any item to force it onto the list.
- **View by vendor:** shows every needing item that has that vendor in `item_vendor`, so standing in Fred Meyer shows *everything she could get there*. An item appears under each of its vendors and is marked "also at: Costco.com, Safeway"; preferred-vendor items sort first.
- **Check-off:** marking an item bought/ordered creates a `purchase`; the item disappears from **all** vendor views immediately (no double buying). The next count of that item closes the loop and clears the purchase.
- Vendor view is a first-class screen: a vendor picker at the top (one tap), big check boxes, works on a phone in a store aisle.

## Measurement methods
Set per item at creation (Manager/Admin), changeable later; history keeps what was recorded.
- **`whole` (default):** whole numbers, numerals-only keypad.
- **`decimal`:** allows fractions (e.g. 0.5 bag); the keypad includes a decimal point.
- **`level`:** fullness buttons, see below.
- **`in_quick_inventory` checkbox:** unchecked items are never in the routine pass (still countable from the item screen, and still shown on shopping lists).

## Level measurement (for case-style items)
Some items aren't worth counting: one case of cream cheese packets, a bulk bag, a jug. We need to know **when it's getting low**, not how many.
- The count card shows four big buttons instead of a keypad: **Over half · Under half · Low · Out**. One tap saves and advances (the fastest action in the app). **Full** is offered too, for "just opened a new case". A small **"Enter a number"** link on every level card switches to the keypad for that one entry (the number is stored as a quantity).
- **Shopping rule for level items:** needs replacing when the latest reading is **Low** or **Out** (a per-item threshold, default `low`; a Manager can raise it to `under_half` for items with long lead times). A typed quantity on a level item is compared to `par_level` if one is set.
- **Multiple locations:** each location has its own reading; a level item needs replacing only if *every* location is at/below the threshold (backstock Full + counter Low means refill the counter, not shop).

## Walking order (location → rack → shelf)
Quick Inventory lists a location's items in the order a person walks it: **rack** (by `sort_order`), then **shelf top to bottom**, then `position`, then name. Group headers show "Rack 2 · Shelf 1 (top)" and a rack/shelf jump list lets a volunteer start mid-room. Auto-advance follows the same order. Items placed in a location with **no shelf set** are grouped last under "Unplaced" and flagged to the Manager so the order can be fixed. Racks and shelves are optional: a small location can use none.

## Bulk placement (admin)
Entering racks and shelves item by item would be the biggest setup chore, so the admin side supports **bulk assignment** (user request, 2026-10-06):
- **Items screen (desktop-first, works on a phone):** search/filter (by name, current location, vendor, "Unplaced"), tick items or **Select all in this view**, then **Assign to…** a location → rack → shelf (new racks/shelves can be created inline in the picker).
- **Add vs. Move:** for a selected item already in that location the shelf is updated; for one not in it, **Add** creates a new placement (an item may live in several locations) while **Move** replaces its existing placement in the source location. The dialog states the counts first ("12 items, 3 moved, 9 added") and confirms before saving.
- **Shelf screen, reverse direction:** open a shelf, tick the items that belong on it from a searchable list ("Add items here"), so someone standing in front of Rack 1 can fill it quickly.
- **Same multi-select, other bulk actions:** set vendor(s), Quick Inventory checkbox, measurement method, par level, active/inactive.
- **Safety:** a bulk change is one D1 batch (all or nothing) with a one-tap **Undo** right after; placements are not history-bearing (counts are), so changing a shelf never touches past counts.

## Quick Inventory behavior
1. Pick a **location** (big list/tabs, each showing "x of y counted" and when it was last done).
2. Items for that location (only those with `in_quick_inventory` on) appear in walking order. Tapping one opens a **count card**: item name, unit, last count as a hint ("last: 6 · 3 days ago"), and a numeric input.
3. Input uses `inputmode="numeric"` so phones show a numbers-only pad; **Enter** (or the big Save button) saves and moves to the next uncounted item. On desktop it's keyboard-only: type, Enter, type, Enter.
4. **Skip** and **Back** are one tap; a finished location shows a summary. No count is recorded for a skipped item.
5. **Typo guard:** a count far from the last one (e.g. 10× or 0 when last was 12) asks "Is that right?" before saving.
6. A saved count shows a brief **Undo**.

## Decisions (user, 2026-10-06)
- Par level is a standard item field. Level-mode items may leave it blank.
- Quick Inventory membership is a per-item checkbox (not every item).
- Measurement method is per item; default whole numbers.
- Kristyn (Cafe Manager) and admins create items, locations, racks, shelves.
- Reorder is judged on the **total across locations**.
- Prices: **later**, not v1. Pack sizes: **deferred** (INIT-0006); shopping lists show counting units and the shopper converts by hand.
- Whether level items appear on every pass, and whether they may span several locations: **decide when needed** (no schema impact either way).

## Open questions
- None blocking v1. (Pack sizes, INIT-0006, are deferred; `item_vendor` can be extended later.)
