# ADR 0005 — Stackable, cumulative roles instead of one role per user

**Status:** Accepted · 2026-10-06
**Related:** `0004-pin-login.md` (replaces its single-role model), `knowledge/architecture/auth-and-users.md`

## Context
ADR-0004 gave each user one role (`volunteer`, `manager`, `admin`). New flows need finer, combinable abilities: counting from what is on hand, shopping (which *creates* stock), and administration. The same person often needs more than one (the Cafe Manager does all three), and a volunteer who also shops should not need a separate "super" role.

## Decision
- Three roles, **stackable and cumulative**: a user holds any number of them and can do everything the union allows.
  - **General** — update inventory from what's available: Quick Inventory counts, check in deliveries, rebalance, and reset their own recent actions.
  - **Shopper** — use the shopping list and record purchases (which creates stock).
  - **Admin** — manage users, items and places, undo anyone's action, reports.
- Roles are **bundles of permissions**. Code checks **permissions** (`inventory.count`, `shopping.use`, `admin.users`, …), never role names, defined once in `worker/permissions.ts`. Moving an ability between roles is a one-line change.
- **No implication:** Admin does not include General or Shopper. The first admin is seeded with all three; give others what they need.
- Stored as rows in `user_role (user_id, role)`. Changing a user's roles ends their sessions so the new abilities apply immediately.
- At least one active user must hold Admin.
- Every signed-in user can read inventory and stock levels; permissions gate actions that change data.

## Consequences
- (+) Matches how the cafe works: one person, several hats; no role explosion.
- (+) New abilities are new permissions; roles can be split later (e.g. an "Item editor" separate from Admin) without touching call sites.
- (−) Stacking means more to configure per person than a single dropdown; the Users screen shows each role's description to keep it clear.
- (−) "Admin" alone can't count stock, which can surprise someone; the screen says roles stack.

## Alternatives considered
- **Hierarchy (admin ⊃ manager ⊃ volunteer)** — simple, but Shopper doesn't fit a ladder (shopping is not "more" than counting).
- **Per-user permission checkboxes** — maximum flexibility, too much to manage; roles are the bundles people understand.
