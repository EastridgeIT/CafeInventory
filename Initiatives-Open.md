# Initiatives — Open

Ideas we intend to (or might) implement, not yet shipped. **Nothing is forgotten here.**

How this file works (full process: `knowledge/conventions/initiatives.md`):
- **Captured** when the user says they're planning something, OR when Claude suggests something the user doesn't explicitly decline.
- **Fleshing-out** — details recorded here *before* implementation.
- When **implemented**, the entry is **moved to `Initiatives-Complete.md`** with what was built and how we got there.
- **Review this file before starting any new idea/process** so we always develop with the future in mind.

Entry template: `knowledge/templates/initiative.md`. IDs are stable and never reused.

---

### INIT-0001 — Cloudflare hosting & API access
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Volunteers (reachable on any phone) and the Cafe Manager (always-on, current data) · low-cost, low-ops hosting
- **Idea:** Host at `inventory.jammin.cafe` on Cloudflare; set up a scoped API token for `wrangler` deploys.
- **Fleshing-out notes:** Token stored per-project via `direnv` `.envrc` (gitignored). Token verified, stack chosen and first deploy to the custom domain done (2026-10-06); moves to Complete once the user declares the first release. Consider Cloudflare Access (email OTP) for volunteer login.
- **Related:** `knowledge/decisions/0002-host-on-cloudflare.md`, `knowledge/architecture/hosting-and-deployment.md`

### INIT-0002 — Par-level reorder list
- **Status:** Captured · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Serves:** Cafe Manager procurement: turns volunteer counts into "what to order"
- **Idea:** Each item has a par level; the app produces a reorder list (count vs. par), grouped by supplier, that can be sent or printed.
- **Fleshing-out notes:** Only as good as how often counts are done, so pair it with "count due" nudges.
- **Related:** —

### INIT-0003 — Offline stock entry
- **Status:** Captured · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Serves:** Volunteers in stockrooms or walk-ins with poor signal
- **Idea:** The PWA queues counts and deliveries while offline and syncs when back online.
- **Fleshing-out notes:** A reason ADR-0003 chose an SPA. Needs conflict rules (last-write vs. sum) and must keep the signed-in user on each record.
- **Related:** `knowledge/decisions/0003-stack.md`

### INIT-0004 — Toast POS integration
- **Status:** Declined · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Declined:** user, 2026-10-06 ("We already have a scheduling system. Not needed.")
- **Serves:** Cafe Manager: estimated stock from actual sales, without anyone counting
- **Idea:** Pull sales from the Toast API and map menu items to recipes/ingredients so stock goes down automatically; counts become corrections.
- **Fleshing-out notes:** Toast API access requires partner/integration approval, so check that first. `toast_employee_ref` on users (ADR-0004) prepares the ground.
- **Related:** `knowledge/decisions/0004-pin-login.md`

### INIT-0005 — Per-vendor shopping lists (extended 2026-10-06: quantity purchased, Undelivered, check-in, rebalance)
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Cafe Manager (Kristyn) shopping efficiently; replaces par-level reorder idea INIT-0002 (merged here)
- **Idea:** Shopping lists filtered by vendor, items with multiple preferred vendors appear under each, check-off removes them everywhere.
- **Fleshing-out notes:** See `knowledge/architecture/stock-counting.md` (Shopping lists). Open: buying-unit vs counting-unit, prices.
- **Related:** INIT-0002

### INIT-0006 — Pack sizes (buying unit vs. counting unit)
- **Status:** Fleshing-out (reopened 2026-10-06 when the item list showed real variants: gallon/half gallon, sleeve/each) · **Source:** User · **Added:** 2026-10-06
- **Serves:** Kristyn: shopping lists that say "1 case" instead of "24 bottles"
- **Idea:** Per item (and likely per vendor), record how it is bought (case of 24, 5 lb bag) vs. how it is counted, and convert on the shopping list.
- **Fleshing-out notes:** User: "will need to consider how to build this out effectively." Vendors may sell the same item in different pack sizes, so it probably lives on `item_vendor`. Needs a design discussion before v2; not in v1 tables. Was deferred; reopened 2026-10-06. Proposal under discussion: one item with optional "forms" (name, equals N base units, preferred buy form, preferred count form), counts and purchases recorded by form, totals/par/need in base units, an Unpack action (sleeve to each). See the conversation notes below once settled.
- **Related:** `knowledge/architecture/stock-counting.md`, INIT-0005

### INIT-0007 — Prices and cost tracking
- **Status:** Deferred · **Source:** User ("maybe later") · **Added:** 2026-10-06
- **Serves:** Kristyn: spending visibility; "cheapest vendor" hints
- **Idea:** Record price per item per vendor; show cost on shopping lists and totals.
- **Fleshing-out notes:** Extra upkeep for whoever keeps prices current; pairs with INIT-0006 (price is per pack).
- **Related:** INIT-0005, INIT-0006

### INIT-0008 — Smarter quick buttons
- **Status:** Declined · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Declined:** user, 2026-10-06 ("We already have a scheduling system. Not needed.")
- **Serves:** Volunteers: fewer taps, fewer scrolls
- **Idea:** Highlight the likely answer on the number buttons (last count, or last count minus typical use); half-step buttons (½, 1, 1½) for `decimal` items; a "usually used per week" nudge.
- **Fleshing-out notes:** Needs real count history first. Don't pre-select a value; an auto-filled guess invites wrong counts.
- **Related:** `knowledge/architecture/stock-counting.md`

### INIT-0009 — Scheduled inventory with alerts and one-tap emailed links
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Cafe Manager: counts get done on time by named people; volunteers get a reminder that takes them straight to counting
- **Idea:** Email addresses on users; an admin schedules a person for an inventory (location or all) at a specific time; the system sends email and in-app alerts, and the email carries a safe one-tap link into Quick Inventory.
- **Fleshing-out notes:** `knowledge/architecture/scheduling-and-notifications.md` and `knowledge/decisions/0006-scheduled-counts-and-magic-links.md` (Proposed). Open: email provider, link lifetime, reminder timing, who is told when a count is missed.
- **Related:** INIT-0010, INIT-0011

### INIT-0010 — Recurring schedules
- **Status:** Declined · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Declined:** user, 2026-10-06 ("We already have a scheduling system. Not needed.")
- **Serves:** Cafe Manager: "Maria counts the pantry every Tuesday at 4 PM" set once
- **Idea:** Weekly/biweekly repeats on a schedule entry, with skip-this-week.
- **Related:** INIT-0009

### INIT-0011 — Push and text-message alerts
- **Status:** Declined · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Declined:** user, 2026-10-06 ("We already have a scheduling system. Not needed.")
- **Serves:** Volunteers who don't watch email
- **Idea:** Web Push to the installed app (home-screen PWA) and optionally SMS, using the same notification queue as email.
- **Fleshing-out notes:** SMS needs a provider and per-person consent; push needs the app installed. Both reuse `notification` rows with a `channel`.
- **Related:** INIT-0009

### INIT-0012 — Notes on item cards
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Volunteers pass on what they see; the Cafe Manager reviews it
- **Idea:** Add a note on any item card; saved independent of counting or skipping; editable by its author for 12 hours; locked and removed from the card after 12 hours or when an Admin acknowledges it; full history in Admin.
- **Fleshing-out notes:** `knowledge/architecture/item-notes.md`. Open: visibility to others, acknowledge comment, alerts to Admins.
- **Related:** INIT-0009

### INIT-0013 — Reminders
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Whoever is using the app that day gets the day's tasks at the right time
- **Idea:** One-time and recurring reminders that appear at or after a time, checked off once for everyone, with an optional button to the right screen; Admin history of done and missed.
- **Fleshing-out notes:** `knowledge/architecture/reminders.md`; prototype `design/reminders.html`.
- **Related:** INIT-0009, INIT-0010

### INIT-0014 — Shelf map editor (admin)
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Admins arrange racks and shelves the way the room is, fast, so Quick Inventory walks in the right order
- **Idea:** Horizontally scrolling shelves (scroll is the default), an intentional Rearrange mode with drag or tap-to-place, and press and hold for Move to within the same location.
- **Fleshing-out notes:** `stock-counting.md` (Shelf map); prototype `design/shelf-map.html`. Touch drag by the handle needs a real-phone test.
- **Related:** INIT-0005

### INIT-0015 — Markouts and waste report
- **Status:** Fleshing-out · **Source:** User · **Added:** 2026-10-06
- **Serves:** Cafe Manager: know what is thrown out or given away, and why
- **Idea:** Perishable items ask "Did we mark any out to avoid expiration?" when counted at 0; markouts recorded with quantity and reason; Admin report by item and week.
- **Fleshing-out notes:** `stock-counting.md` (Markouts). Open: prompt only at 0?
- **Related:** INIT-0007

### INIT-0016 — Item import from the user's spreadsheet
- **Status:** Captured · **Source:** User · **Added:** 2026-10-06
- **Serves:** Admin setup: load the real item list instead of typing it
- **Idea:** Admin import of a CSV/spreadsheet: items, units, par levels, vendors, locations/shelves, measurement method, Quick Inventory flag.
- **Fleshing-out notes:** The user sent the list on 2026-10-06 (66 lines): `data/item-list-original.txt` (verbatim). A draft import is in `data/item-import-draft.csv` (79 items after expanding slash variants into separate items, a category per blank-line block, units, measurement method, markout flag). It contains names only: no locations, par levels or vendors yet. Awaiting the user's answers on variants, units, categories and level-with-sealed-bottles for syrups and sauces.
- **Related:** INIT-0005
