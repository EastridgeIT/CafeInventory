---
status: active
read-when: Naming anything in code, database, API, or UI.
related: [../architecture/auth-and-users.md]
updated: 2026-10-06
---

# Naming lexicon (ubiquitous language)

**One canonical key per concept**, used identically in code, DB, and API. Intentional naming is a hard requirement — no synonyms proliferating. Separate concerns ruthlessly (e.g. **physical** vs **logical**). This file is the source of truth for the canonical terms.

## Canonical terms

| Concept | Default label (`key`) | Notes / avoid |
|---|---|---|
| A person who can sign in | **User** (`user`) | Avoid "account", "member", "staff". Role is an attribute, not a separate entity. |
| Role: update inventory from what is available | **General** (`general`) | Counts, check in, rebalance. Roles stack; never call a person "a general". |
| Role: use the shopping list, record purchases | **Shopper** (`shopper`) | Creates stock. |
| Role: administration, reports, undo anyone's action | **Admin** (`admin`) | Does not imply General or Shopper. |
| What a role allows | **Permission** (`permission`) | e.g. `inventory.count`; code checks permissions, not role names. |
| Numeric sign-in secret (4–8 digits) | **PIN** (`pin`) | Never "password" or "passcode". **Never interchange with a Toast PIN.** |
| A thing the cafe stocks | **Item** (`item`) | Avoid "product", "SKU", "ingredient". |
| A physical place stock is kept | **Location** (`location`) | e.g. Beverage Case, Cafe Counter, Cafe Pantry. Avoid "shelf", "area". |
| An item's presence in a location (and shelf) | **Item location** (`item_location`) | The answer to "Where will I find this?". Never interchange with Location. |
| A recorded quantity of one item in one location at one time | **Stock count** (`stock_count`) | Append-only. Avoid "inventory record", "entry". |
| Total of an item across locations | **Current stock** (`current_stock`) | Derived from latest counts; never stored. |
| The volunteers' primary counting screen | **Quick Inventory** (`quick_inventory`) | |
| A place the cafe buys from | **Vendor** (`vendor`) | Costco.com, Chef Store, Fred Meyer. Avoid "supplier", "store", "source". |
| An item's approved vendor | **Item vendor** (`item_vendor`) | Ranked by `preference`. Never interchange with Item location (where stock sits vs. where it's bought). |
| Items that need replacing, viewed by vendor | **Shopping list** (`shopping_list`) | Derived, not stored. |
| A recorded buy of an item (quantity) | **Purchase** (`purchase`) | Append-only. Adds to Undelivered. |
| System location holding bought-but-not-shelved stock | **Undelivered** (`location.kind = 'undelivered'`) | Avoid "on order", "in transit". Not countable. |
| Stock that moves between places between counts | **Stock movement** (`stock_movement`) | Signed `delta`; transfers are two rows in one `group_id`. |
| Screen: put delivered stock on shelves | **Check in** (`check_in`) | Avoid "receive". |
| Screen: move stock between places, total unchanged | **Rebalance** (`rebalance`) | Avoid "transfer" in the UI. |
| An item's default backstock place | **Backstock location** (`item_location.is_backstock`) | Default source for Rebalance. |
| How an item is measured | **Measurement method** (`measurement_method`: `whole` \| `decimal` \| `level`) | Avoid "count mode", "unit type". |
| Largest number shown as a one-tap button for an item | **Quick max** (`quick_max`) | Must be ≥ par level. Avoid "button limit", "max count". |
| Removing a mistaken count so it never counted | **Void** / UI label **Reset this count** (`voided_at`) | Never "delete" or "revert". Voided rows are excluded from every calculation. |
| A person scheduled to count at a time | **Inventory assignment** (`inventory_assignment`) | UI: "scheduled inventory". Avoid "shift", "task". |
| A queued email or alert | **Notification** (`notification`) | `channel` = email or in_app. |
| The emailed one-tap sign-in | **Count link** (`login_link`) | Scoped to one assignment. Avoid "magic link" in the UI. |
| A short text attached to an item card | **Item note** (`item_note`) | Avoid "comment", "memo". Active on the card 12 hours. |
| Admin confirms they've seen a note | **Acknowledge** (`acknowledged_at`) | Locks the note and removes it from the card. |
| A task shown on Home at a time of day | **Reminder** (`reminder`, `reminder_occurrence`) | Avoid "alert" (that is the email/in-app notification). Recurring or one-time. |
| Waste thrown out or given away to avoid expiry | **Markout** (`markout`) | Avoid "waste", "spoilage" in the UI. |
| Stock added with no delivery or move behind it | **Found stock** (`stock_movement.kind = 'found'`) | Needs an explanation; Admin reviews. |
| The partly used case of a level item | **Open case** | With **sealed cases** (unopened). |
| A rack within a location | **Rack** (`rack`) | Optional. |
| A shelf, top to bottom | **Shelf** (`shelf`) | Belongs to a location, optionally a rack. Avoid "row", "tier". |
| A fullness reading (Full, Over half, Under half, Low, Out) | **Level** (`level`) | Used by level-mode items. Never summed. Avoid "gauge", "status". |
| A signed-in browser | **Session** (`session`) | |
| Link to the Toast POS employee | **Toast employee ref** (`toast_employee_ref`) | An identifier only, never a Toast PIN. |

> Fill this table as the domain model solidifies. Terms that are easy to conflate should carry an explicit "never interchange" note.

## Identity rule
Everything is identified internally by **opaque, stable IDs** (e.g. UUIDv7/ULID), never by a user-chosen name. Names/labels are mutable attributes. This is what makes rename, re-parent, and swap-upgrade safe.

## Canonical keys, not display strings
Code/DB/API reference stable **canonical keys**, never display strings. If the product needs tenant-renamable labels or i18n, resolve keys → labels through a terminology layer (record that as an ADR). Building this from day one keeps every user-facing string swappable.
