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
- `item` — `id`, `name`, `unit_label` (e.g. "bags", "cases"), `measurement_method` (`whole` default | `decimal` | `level`, see below), `quick_max` (nullable integer; see Quick buttons), `in_quick_inventory` (checkbox, default on), `active`, `par_level` (total across locations; **a normal field on every item**, user decision 2026-10-06; Kristyn sets them at setup. A `level`-mode item may leave it blank because its Low/Out threshold drives the list instead).
- `item_location` — `item_id`, `location_id`, optional `shelf_id`, `position` (order within the shelf). This is the "Where will I find this?" answer, down to the shelf for items where that matters.
- `stock_count` — **append-only, with one exception: voiding** (see Reset): `id`, `item_id`, `location_id`, exactly one of `quantity` (whole by default; fractional only for `decimal` items) or `level`; `is_minimum` (0/1, set only by a "More than X" tap: the quantity is a lower bound) (`full` | `over_half` | `under_half` | `low` | `out`), `counted_by` (user id), `counted_at`, and nullable `voided_at`, `voided_by`, `void_reason`. Never edited; a correction is a new count. History is the audit trail.
- **Every calculation ignores voided counts** (current stock, "last counted", staleness, pass progress): query through a view `active_stock_count` (`WHERE voided_at IS NULL`); never read the raw table for business logic.
- **Current stock** of a `quantity` item = sum over its locations of the *latest* count per location. A `level` reading is never summed; it's shown as its label ("Over half"). "Last counted" and staleness come from the same rows.

- `vendor` — `id`, `name` (Costco.com, Chef Store, Fred Meyer, Safeway, …), `kind` (`online` | `in_store`), `sort_order`, `active`.
- `item_vendor` — `item_id`, `vendor_id`, `preference` (rank: 1 = preferred), optional `vendor_url`/`vendor_sku` later. An item can have several vendors (Coke: Costco.com, Fred Meyer, Safeway).
- `purchase` — **append-only**: `id`, `item_id`, `vendor_id`, `quantity`, `by_user`, `purchased_at` (+ void columns). One row each time someone records "I bought N" on the shopping list. (Replaces the earlier `status` ordered/bought idea: an online order and an in-store buy both land in Undelivered.)
- `location.kind` (`normal` | `undelivered`): exactly one system location, **"Undelivered"**, holds purchased stock until it is checked in. It can't be renamed, deleted, shelved, or counted in Quick Inventory.
- `stock_movement` — **append-only**, the ledger of stock that moves *between* counts: `id`, `item_id`, `location_id`, `delta` (signed, never 0), `kind` (`purchase` · `check_in` · `rebalance` · `cancel`), `group_id` (ties the legs of one action together), `purchase_id` (for purchases), `by_user`, `at`, and void columns. A transfer is two rows (−n at the source, +n at the destination) in one `group_id`; a purchase is one row (+n at Undelivered).

## Balance per location (quantity items)
`balance(item, location)` = the latest active count's quantity at that location (0 if never counted) **plus the sum of active movement deltas at that location after that count's time**. A count is the truth at its moment, so movements recorded *before* a count are absorbed by it. `current_stock(item)` = sum of balances over **all locations including Undelivered**, so a purchase immediately counts toward stock and the item stops showing as needed. Screens show "On hand 21 · plus 24 undelivered". "More than X" counts use X as the baseline (approximate). Balances are never stored, always derived (through `active_stock_count` and an `active_stock_movement` view). Level-measured items have no numeric balance: movements don't apply to them; checking one in sets its level to **Full** at the chosen location (a new case).

## Purchases, check-in, rebalance (user, 2026-10-06; prototype: `design/stock-flows.html`)
1. **Buy (on the shopping list):** the check box becomes a **quantity**. Tap an item: the card offers one big button with the suggested amount ("Bought 27"), a keypad for a different number, and Save. This records a `purchase` (vendor = the vendor tab she is on) and a `+n` movement at Undelivered. Buying less than needed leaves the rest on the list automatically (the need is recomputed from stock including undelivered).
2. **Check in deliveries (own screen):** lists items with stock in Undelivered. Tap one, split the delivered quantity across places ("8 here, 12 there"; rows default to the item's locations, prefilled with everything going to its default backstock), and **Put away**. Writes `−n` at Undelivered and `+n` at each destination (`check_in`). Anything not placed stays undelivered (partial deliveries). **"Not coming"** clears the remainder (`cancel`, `−n` at Undelivered) for short or cancelled orders.
3. **Rebalance (own screen):** moves stock between places without changing the total. Pick the item, pick the place you are setting (default: its front/home location), type the new quantity. If it goes **up** (5 → 8) a **"Move from"** dropdown (default: the item's backstock location; also other locations and **Undelivered**) shows where the 3 come from; if it goes **down**, a **"Move to"** dropdown defaults to backstock. Saves a two-leg `rebalance`. If the source doesn't have enough, saving is blocked with the source's balance shown and a link to count it first (open question below).
4. **Undo:** an immediate Undo (and Reset on the latest action) **voids the whole group**, the same pattern as counts. Who can void: whoever made it, plus Manager/Admin.
5. **Items need a backstock location:** `item_location.is_backstock` (0/1, at most one per item) marks the default source/destination.

## Who can do what (ADR-0005)
- **General:** counts, Check in, Rebalance, and Reset/Undo of their **own** recent actions.
- **Shopper:** shopping list and recording purchases (creates stock).
- **Admin:** setup (items, locations, racks, shelves, vendors, bulk placement), voiding **anyone's** action, reports, users.
Roles stack; abilities are the union. Anyone signed in can read stock levels and shopping needs. Wherever these docs earlier say "Manager/Admin", read it as the **Admin** role (Kristyn holds General + Shopper + Admin).

## Shopping lists (derived, not stored)
- An item **needs replacing** when `current_stock < par_level`, where `current_stock` already includes Undelivered (so a purchase removes the need at once). Suggested quantity = `par_level − current_stock`. Volunteers can also tap **"We're out / low"** on any item to force it onto the list.
- **Store filter is a dropdown, not pills** (user, 2026-10-06): a native select at the top of the list showing each store with its item count ("Fred Meyer (2)"); scales to many stores and works well one-handed. The last store chosen is remembered per device.
- **View by vendor:** shows every needing item that has that vendor in `item_vendor`, so standing in Fred Meyer shows *everything she could get there*. An item appears under each of its vendors and is marked "also at: Costco.com, Safeway"; preferred-vendor items sort first.
- **Buying:** entering the quantity bought creates a `purchase` and the Undelivered movement; the need drops (or disappears) in **all** vendor views at once, so nobody buys it twice. Check-in later moves it to shelves.
- Vendor view is a first-class screen: a vendor picker at the top (one tap), big check boxes, works on a phone in a store aisle.

### Adding by hand: more quantity, catalog items, new items (user, 2026-10-06; prototype `design/stock-flows.html`)
- **More of what is listed:** on an item's card, "Need more than 27? Add to the list" (+1, +2, +6, +12, or any number). The list quantity becomes the automatic shortfall **plus** what was added by hand, shown as "Need 33 · 6 added by hand". The big **"Bought 33"** button follows.
- **"+" in the header:** opens a **catalog picker** (search, each row shows stock and "On the list"). Tap an item, then one tap on a quantity (1, 2, 3, 4, 5, 6, 12, 24) or type another number. An item that isn't under par appears as "Want 3".
- **Vendor tie:** an item added by hand shows on the vendor tab it was added from (even if it isn't normally bought there), and buying it records that vendor. It does not add that vendor to the item permanently.
- **New item on the spot:** "+" > **New item**: name, "counted in" unit, how many to buy. Live **duplicate hints** ("Already in the catalog? Oat milk") appear as the name is typed. It creates a **draft** item (`item.needs_review = 1`): usable on the list, purchasable, checkable-in, but **not in Quick Inventory** until an Admin completes setup (where it lives, par level, vendors, measurement). Admin Items has a "Needs setup" filter. Requires `shopping.new_item` (Shopper role).
- **Data:** `shopping_request` (append-only, voidable): `id`, `item_id`, `vendor_id` (nullable: the tab it was added from), `quantity` (> 0), `by_user`, `requested_at`, `closed_by_purchase_id`, void columns. **Open** requests add to the item's list quantity; **recording any purchase of that item closes all its open requests** (a partial buy does not keep an old manual remainder; the automatic shortfall still carries what is truly short). Undoing the purchase reopens them; undoing an add voids it, and undoing a new-item creation also removes the draft item if nothing else uses it.
- `list_quantity(item) = max(0, par − current_stock) + Σ open requests`.

## Measurement methods
Set per item at creation (Manager/Admin), changeable later; history keeps what was recorded.
- **`whole` (default):** whole numbers, numerals-only keypad.
- **`decimal`:** allows fractions (e.g. 0.5 bag); the keypad includes a decimal point.
- **`level`:** fullness buttons, see below.
- **`in_quick_inventory` checkbox:** unchecked items are never in the routine pass (still countable from the item screen, and still shown on shopping lists).

## Quick buttons (user decision, 2026-10-06; layout: option A "Guided card")
Fewer taps: instead of a keypad, a `whole` item shows **number buttons sized to that item**: `quick_max = 6` for milks, `12` for cups and lids, `24` for bottled beverages. Set per item by the Manager/Admin; `quick_max` blank means keypad.
- Buttons: **None** (0), **1 … quick_max**, and **More than quick_max**. **None** and **More than** sit **below** the numbers (user decision) in a row **pinned to the bottom of the card**, so on a 24-button item the numbers scroll above them and these two are never hidden. One tap saves and auto-advances (no Save button).
- **"More than X"** stores `quantity = X` with `is_minimum = 1`. Displayed as "More than 6", counted as X in totals and **always treated as comfortably stocked** (see the rule below).
- A small **"Enter a number instead"** link switches that one entry to the keypad (exact count, no `is_minimum`). The "Is that right?" typo guard applies to keypad entries only; a deliberate button tap is trusted, and Undo covers slips.
- **Rule:** `quick_max` must be **≥ `par_level`**, enforced in the item form, so "More than X" can never hide a reorder. The form suggests `quick_max` from the par level (round up, cap 24).
- Order of the count card by `measurement_method`: `level` → fullness buttons; `whole` with `quick_max` → number buttons; `whole` without it, and `decimal` → numerals-only keypad (decimal key for `decimal`).

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

## Reset (remove a count completely)
User requirement (2026-10-06): a mistaken count must be removable so that it **looks as if nobody counted or verified that item at all**. Changing the number back is not acceptable, because it would record a count that never happened.
- **Where:** on the count card of any item that has a count in this pass, a **"Reset this count"** button (visible via Back, or by tapping the item in the list). One confirm step ("Remove this count completely?"), then the item returns to uncounted.
- **What it does:** **voids** the latest active `stock_count` for that item and location (sets `voided_at/by`). Every normal view and calculation then behaves as if it never existed: "last counted" and current stock revert to the previous real count, and the item shows as uncounted in the pass. A second reset steps back to the one before.
- **Undo toast = the same operation:** the "Saved…Undo" tap voids the count rather than adding a correcting one.
- **Intent:** an "oops" in the moment ("I didn't mean to record that"), not a way to rewrite history. Corrections to older counts are made by counting again.
- **Who:** the person who entered it (within the same pass) and Manager/Admin at any time. Volunteers cannot reset a count someone else entered.
- **Trace:** voided rows stay in the table and show only in an **Admin-only audit view** (who, when, original value, reason optional). No normal screen, history or report shows them. Choosing a hard delete instead would remove even that; I recommend keeping the quiet audit row, because with shared Toast-style PINs it's the only record if a count is ever disputed.
- A **skip** isn't a record, so there is nothing to reset.

## Shelf map (admin; user, 2026-10-06; prototype `design/shelf-map.html`)
A location view that mirrors the room: an **Unplaced** tray, then a card per **rack**, each **shelf** a **horizontally scrolling row** of item tiles (location chosen from a dropdown).
- **Drag and drop (Admin):** reorder within a shelf or move across shelves and to/from Unplaced. The shelf autoscrolls near its edges and the page near the top/bottom; an insertion bar shows the drop spot; Escape cancels. Mouse can drag from anywhere on the tile; **touch drags by a handle** at the tile's top-left (`touch-action: none`), so swiping anywhere else still scrolls the shelf.
- **Press and hold = "Move to":** hold a tile (about half a second), right-click it, press Enter on it, or tap its three-dot button. A sheet lists every rack and shelf **in the same location** plus Unplaced, and **Move left / Move right / To start / To end**. Moving between locations is bulk placement, not this screen.
- **Every move shows Undo.** Server: one call per move (`item_id`, `location_id`, destination `shelf_id` or null, index) that renumbers `item_location.position` in the source and destination shelves in a single D1 batch. Needs `admin.catalog`. Two admins editing at once: last write wins.
- **Verified in a desktop browser with a real mouse:** all of the above, including autoscroll and keyboard. **Touch:** press-and-hold, Move to, and Move left/right work in an emulated phone. Dragging by the handle with a finger **could not be confirmed** (the browser cancelled the gesture in the test tool for a reason I couldn't isolate), so test it on a real phone; the Move to menu is the touch fallback and covers every move.

## Quick Inventory behavior
1. Pick a **location** (big list/tabs, each showing "x of y counted" and when it was last done).
2. Items for that location (only those with `in_quick_inventory` on) appear in walking order. Tapping one opens a **count card**: item name, unit, last count as a hint ("last: 6 · 3 days ago"), and a numeric input.
3. **Every count card shows "Last update:"** with the quantity (or level), the **date and time**, and **who recorded it** (display name), e.g. "4 bags · Saturday · Maria". **Date display rule (user, 2026-10-06), by calendar days ago in the cafe's time zone (America/Los_Angeles):** today → **"Today 10:35 AM"** (time only on the same day); 1 day → **"Yesterday"**; 2–6 days → the full day name (**"Sunday"**); 7+ days → short day and date (**"Wed 9/24"**, with a two-digit year added only if it is a different year, e.g. "Wed 9/24/25"). Implemented once in a shared `formatWhen(date, now)` function with unit tests; the stored value is always ISO-8601 UTC. It reads the latest *active* count (voided counts excluded), so after a Reset it reverts to the previous real update. The same line appears in the Quick Inventory list rows. The typo guard compares against this value.
4. Input uses `inputmode="numeric"` so phones show a numbers-only pad; **Enter** (or the big Save button) saves and moves to the next uncounted item. On desktop it's keyboard-only: type, Enter, type, Enter.
5. **Skip** and **Back** are one tap; a finished location shows a summary. No count is recorded for a skipped item.
6. **Typo guard:** a count far from the last one (e.g. 10× or 0 when last was 12) asks "Is that right?" before saving.
7. A saved count shows a brief **Undo**.

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
