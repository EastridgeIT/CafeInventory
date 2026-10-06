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
- **Status:** Captured · **Source:** Suggested (not declined) · **Added:** 2026-10-06
- **Serves:** Cafe Manager: estimated stock from actual sales, without anyone counting
- **Idea:** Pull sales from the Toast API and map menu items to recipes/ingredients so stock goes down automatically; counts become corrections.
- **Fleshing-out notes:** Toast API access requires partner/integration approval, so check that first. `toast_employee_ref` on users (ADR-0004) prepares the ground.
- **Related:** `knowledge/decisions/0004-pin-login.md`
