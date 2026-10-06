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
- **Fleshing-out notes:** Token stored per-project via `direnv` `.envrc` (gitignored). Token created & verified 2026-10-06 (scoped to the jammin.cafe zone only). Remaining: choose runtime/storage with the stack ADR, first deploy + custom domain. Consider Cloudflare Access (email OTP) for volunteer login.
- **Related:** `knowledge/decisions/0002-host-on-cloudflare.md`, `knowledge/architecture/hosting-and-deployment.md`
