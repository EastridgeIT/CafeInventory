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
| Role: logs stock activity | **Volunteer** (`volunteer`) | |
| Role: owns procurement | **Manager** (`manager`) | UI label "Cafe Manager". |
| Role: manages users & settings | **Admin** (`admin`) | |
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
| A recorded buy/order of an item | **Purchase** (`purchase`) | Append-only. |
| How an item is measured | **Measurement method** (`measurement_method`: `whole` \| `decimal` \| `level`) | Avoid "count mode", "unit type". |
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
