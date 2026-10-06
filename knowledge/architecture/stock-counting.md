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
- `stock_movement` — **append-only**, the ledger of stock that moves *between* counts: `id`, `item_id`, `location_id`, `delta` (signed, never 0), `kind` (`purchase` · `check_in` · `rebalance` · `cancel` · `found` · `markout`), `group_id` (ties the legs of one action together), `purchase_id` (for purchases), `reason` (required for `found`), `reviewed_at`/`reviewed_by` (Admin review of `found`), `by_user`, `at`, and void columns. A transfer is two rows (−n at the source, +n at the destination) in one `group_id`; a purchase is one row (+n at Undelivered).

## Balance per location (quantity items)
`balance(item, location)` = the latest active count's quantity at that location (0 if never counted) **plus the sum of active movement deltas at that location after that count's time**. A count is the truth at its moment, so movements recorded *before* a count are absorbed by it. `current_stock(item)` = sum of balances over **all locations including Undelivered**, so a purchase immediately counts toward stock and the item stops showing as needed. Screens show "On hand 21 · plus 24 undelivered". "More than X" counts use X as the baseline (approximate). Balances are never stored, always derived (through `active_stock_count` and an `active_stock_movement` view). Level-measured items have no numeric balance: movements don't apply to them; checking one in sets its level to **Full** at the chosen location (a new case).

## Purchases, check-in, rebalance (user, 2026-10-06; prototype: `design/stock-flows.html`)
1. **Buy (on the shopping list):** the check box becomes a **quantity**. Tap an item: the card offers one big button with the suggested amount ("Bought 27"), a keypad for a different number, and Save. This records a `purchase` (vendor = the vendor tab she is on) and a `+n` movement at Undelivered. Buying less than needed leaves the rest on the list automatically (the need is recomputed from stock including undelivered).
2. **Check in deliveries (own screen; user, 2026-10-06):** every item with stock in Undelivered is listed with **three toggle buttons**: **Check In All** (everything goes to the item's backstock location; "Choose places" splits it, "8 here, 12 there"), **Still Undelivered** (the default; leave it), and **Partial Delivery** (enter how many arrived and where each went; the rest stays undelivered). One **Put away** button commits every item not left on Still Undelivered. It writes `−n` at Undelivered and `+n` at each destination (`check_in`). **"Not coming"** (inside Partial) clears the remainder (`cancel`) for short or cancelled orders. **Over-delivery** (more than was undelivered) is allowed but needs a **written explanation**; the extra is recorded as found stock (below) tied to that check-in.
3. **Rebalance (own screen):** moves stock between places. **The total never changes, and you can't rebalance more than is present.**
   - **Check in first is required** (user, 2026-10-06). If the item has any stock in Undelivered, Rebalance is blocked for that item: an alert says "Check in first. 24 are still undelivered", with a **Check in 24 now** button that opens Check in (Check In All selected) and a way back. **Undelivered is never offered as a source** in Rebalance.
   - Pick the item, the place you are setting (default: its front/home location) and type the new quantity. An **increase** (5 → 8) draws from the item's **backstock location first**, then its other places in turn (a "Move from" line the volunteer can change); a **decrease** goes back to backstock ("Move to"). Saves a two-leg `rebalance`.
   - **"Not enough in the source" alert**, with easy fixes. Backstock and every other place with stock are **combined**, so the volunteer is only told about what is still short after all of them are used. The alert offers: **(a) Use N instead**, the most that is available; **(b) Add the rest as found stock** (below), which needs a written explanation. You can't rebalance more than is present. Nothing is saved until the move is fully covered.
4. **Undo:** an immediate Undo (and Reset on the latest action) **voids the whole group**, the same pattern as counts. Who can void: whoever made it, plus Admin (`admin.void_any`).
5. **Items need a backstock location:** `item_location.is_backstock` (0/1, at most one per item) marks the default source/destination.

## Found stock (stock with no source; user, 2026-10-06)
Something turns up that no delivery or move explains (a bottle that fell behind the case, more arrived than were bought). Any person with `inventory.count` can **add it independently from a check-in**: **Add anyway** from the Rebalance "Not enough in the source" alert, or **Add found stock** on an item card.
- **Required:** quantity (> 0), place, and a written **explanation** (5 to 300 characters). No explanation, no save.
- Writes a `stock_movement` of kind `found` (`+n` at the place, with `reason`, `by_user`, `at`). It is voidable like any movement.
- **Flagged for Admin review**: found stock appears in the Admin review queue (alongside notes) until an Admin chooses Acknowledge. It never blocks the volunteer.
- The extra from an over-delivery at Check in uses the same record.
- A count is still the truth for a place: simply counting a place higher also raises it. "Found stock" exists for flows that otherwise keep the total constant (Rebalance, Check in) and for leaving a reason on the record.

## Markouts (end-of-shift waste; user, 2026-10-06)
Perishable items (bagels, muffins, burrito and bowl servings) thrown out or given away so they don't expire are recorded as **markouts**.
- `item.ask_markout` (0/1, Admin-set). When a volunteer saves a count of **0** on such an item in Quick Inventory, the card asks **"Did we mark any out to avoid expiration?"** with **No** (one tap) or a **quantity** (the item's number buttons or keypad) and an optional reason (Expiring · Gave away · Damaged, default Expiring). Also reachable any time from the item card ("Mark out…").
- `markout` (append-only, voidable): `id`, `item_id`, `location_id`, `quantity` (> 0), `reason`, `count_id` (the count that prompted it; nullable), `by_user`, `at`. **When linked to a count (the normal case) it is informational**: the count of 0 already reflects the loss, so balances are not reduced twice. A **standalone** markout (no count) subtracts from the place's balance like a movement of `−n`.
- **Admin > Reports:** markouts by item, place and week (cost can be added when prices exist; INIT-0007). Needs `admin.reports`.

## Who can do what (ADR-0005)
- **General:** counts, Check in, Rebalance, found stock, markouts, and Reset/Undo of their **own** recent actions.
- **Shopper:** shopping list and recording purchases (creates stock).
- **Admin:** setup (items, locations, racks, shelves, vendors, bulk placement), voiding **anyone's** action, reviewing found stock and notes, reports (including markouts), users.
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

## Variants (sizes and packages of one item; user, 2026-10-06; numbers pending)
One item can come in several **variants** (Gallon / Half Gallon, Sleeve / Case, Pack / Each). **Not separate items**: the same item, tracked as separate variants (user, 2026-10-06). Most items have a single implicit variant and look exactly as before.
- **Base unit and conversion.** Each item has a **base unit** (the unit its par level is measured in). Each variant is defined as "equals N base units" (Half Gallon = 0.5 gallon; Case = a number of sleeves). Conversion feeds **totals, par, need and suggestions only**; there is no recipe or unit engine.
- **Count by variant.** Volunteers count what they see: "2 gallons, 3 half gallons". Stock is kept per (item, place, variant); an item's current stock is the sum converted to base units. Mixed inventory just works; zero variants are skipped. Quick Inventory shows the **preferred count variant's** buttons first and small rows for the others.
- **Preferences.** `preferred_to_buy` and `preferred_to_count` are set per item and may differ (cups: buy Case, count Sleeve). We prefer Gallon but can pivot at any time.
- **Shopping list.** The need is "how much short, in base units". The suggestion is shown in the **preferred buy variant, rounded up** ("Need 3.5 gallons. Suggest 4 gallons, or 7 half gallons"), with what we have by place and variant underneath so the shopper can decide in the store. Buying records **rows of variant x quantity** ("3 Gallons + 2 Half Gallons"); the need drops by their converted total and any remainder stays on the list. Undelivered, Check in and Rebalance keep the actual variants.
- **Unpack.** A larger variant can be opened into a smaller one at the same place: **"Opened a sleeve"** is `-1` Sleeve and `+N` Each in one tap (a `stock_movement` of kind `unpack`, both legs, total unchanged), the same idea as "Opened a new case" for level items.
- **Data.** `item_variant` (`id`, `item_id`, `name`, `equals_base_units` > 0, `sort_order`, `active`); `item.base_unit`, `item.buy_variant_id`, `item.count_variant_id`; `variant_id` (nullable = the item's only variant) on `stock_count`, `stock_movement` and purchase lines. Changing a conversion later changes how past totals compute; renaming is safe.
- **Built (2026-10-06):** `item_variant`, the preferred buy/count variants and draft flag exist in the database and the Admin > Items screen (migration 0005); counts, purchases and shopping do not use variants yet. `item.unit_label` is the base unit. A variant's conversion may be unknown (null) until the user supplies it.
- **Rule the data hit:** quick buttons (`quick_max`) must reach at least the par level, so milk with buttons 1 to 6 can't have a minimum above 6; raise the buttons (up to 24) or lower the minimum.
- **Import:** `data/item-import-draft.csv` (66 items, 13 with variants) and `data/item-variants-draft.csv`. Unknown conversions (cups and lids per sleeve and sleeves per case, carriers per pack, slices per loaf) are blank for the user to fill.

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
- **Open case + sealed cases (user, 2026-10-06):** a level item holds two things per place: the **open (partial) case**, read as a fullness level or a typed quantity (for example "running low", or 37 packets), and **sealed cases** (a whole number, usually 0 or 1). **Check in** of a level item adds sealed cases (default 1), or sets the open case to **Full** if nothing is open. Tapping **"Opened a new case"** on the card sets the open case to Full and subtracts one sealed case (if any). **Shopping rule:** a level item needs replacing only when the open case is at or below its threshold **and no sealed case remains**. Data: `stock_count.sealed` (integer ≥ 0) saved with level counts; between counts, sealed changes are `stock_movement` rows whose `delta` is in cases.
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
A location view that mirrors the room: an **Unplaced** tray, then a card per **rack**, each **shelf** a **horizontally scrolling row** of item tiles (location from a dropdown).
- **Scrolling is the default** (user, 2026-10-06). In normal mode nothing can be dragged or moved by accident: swipe or scroll a shelf freely; each shelf header has **‹ ›** buttons for mouse users. No drag handles are shown.
- **An intentional "Rearrange" button** switches the screen into editing (it becomes **Done**, with a banner). In Rearrange mode, scrolling still works, and there are two ways to move things:
  1. **Drag** a tile by its handle (mouse or touch). The shelf autoscrolls near its edges and the page near the top and bottom; an insertion bar shows the spot; Escape cancels.
  2. **Tap to pick up, tap a "+" to place** (the reliable touch way, no gesture conflict): tapping a tile picks it up (highlighted, with a hint bar and Cancel), every gap between tiles and each shelf's end shows a **+**, and tapping one places it, on the same shelf or any other, including Unplaced. Tapping the picked tile or pressing Escape cancels.
- **Press and hold = "Move to" at any time** (also right-click, Enter on a focused tile, or the three-dot button): a sheet lists every rack and shelf **in the same location** plus Unplaced, with **Move left / Move right / To start / To end**. Moving between locations is bulk placement, not this screen.
- **Every move shows Undo.** Server: one call per move (`item_id`, `location_id`, destination `shelf_id` or null, index) that renumbers `item_location.position` in the source and destination shelves in a single D1 batch. Needs `admin.catalog`. Two admins at once: last write wins.
- **Verified in a desktop browser:** default mode is inert (drag does nothing, arrows scroll, press-and-hold works); Rearrange: handles appear, tap-to-place (between tiles, within a shelf, undo, cancel by tap and Escape), mouse drag, press-and-hold without picking up, Done restores normal mode. **Verified in an emulated phone:** tap-to-pick and tap-to-place, and press-and-hold with Move to. **Not confirmed:** finger drag by the handle (the test tool's browser cancelled the gesture for a reason I couldn't isolate); tap-to-place is the designed touch path and does not depend on it.

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
- Level items: is one sealed case the usual maximum, or can several be stored? Default: any number, shown as a whole number.
- Variants: the conversion numbers (see Import above). Vendor-specific sizes and prices are still not modeled (`item_vendor` can be extended later).
- Pacific time (America/Los_Angeles), **DST-aware**, for every date and time shown or scheduled; stored in UTC.
- Check in uses Check In All / Still Undelivered / Partial Delivery toggles per item; over-delivery needs a written explanation.
- Rebalance requires undelivered stock to be checked in first and never uses Undelivered as a source; it can't exceed what is present; shortfalls show the "Not enough in the source" alert with two fixes (use the maximum available, or add found stock with a reason).
- Found stock (Add anyway) needs an explanation and is flagged for Admin review.
- Level items hold one open case plus sealed cases; check-in adds a sealed case.
- Markouts: perishable items are asked "Did we mark any out to avoid expiration?" **only when counted at 0** (a sharp drop could just be sales; user, 2026-10-06).
- Removed (Reset) counts: the hidden Admin-only record stays by default (the user's answer moved to markouts without objecting).
