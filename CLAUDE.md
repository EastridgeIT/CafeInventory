# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is a **router**, not a library. It is loaded into context every session, so it stays small: the always-true essentials, plus an **index** of the on-demand knowledge base. Read individual `knowledge/` files only when a task needs them.

---

## What Cafe Inventory is

A stock tracker for the Eastridge cafe. Volunteers record deliveries, usage, and stock counts quickly; the Cafe Manager gets timely, trustworthy stock levels and knows what to reorder.

---

## North Star — the vision that must permeate everything

> **Effortless for volunteers; timely for procurement.**

- **Volunteers first.** If logging stock takes more effort than a clipboard, volunteers won't do it, and the data goes stale.
- **Data serves the order.** Every screen and field must earn its place by helping the Cafe Manager decide what to buy and when.

<!-- TODO: expand the vision -->

**Guiding heuristic (apply to every decision):** *Does the ease of use promote use by volunteers and provide the timely info the Cafe Manager needs for procurement?*

---

## How we work together — Partnership Contract

Every recommendation offers, where they exist:
1. **The adjacent opportunity** — the natural "…and we could also do X."
2. **The next-level leap** — the more ambitious idea you didn't ask for and might not have considered.
3. **Truth alongside both** — risks, costs, tradeoffs stated plainly, and honest pushback when something works against the vision. **Intellectual honesty over agreeableness, always.**

Operating rules:
- **Log initiatives.** Anything the user says they're planning, or any idea I suggest that the user doesn't explicitly decline, gets recorded in `Initiatives-Open.md`. No idea is forgotten.
- **Review the future first.** Before starting any new idea/process, read `Initiatives-Open.md` and build with the known future in mind.
- **Maintain the canon.** When a change touches something documented, update it in the *same* change. See `knowledge/conventions/docs-and-staleness.md`.

Full contract: `knowledge/conventions/partnership-contract.md`.

---

## Always-on essentials

- **Versioning:** product version `MAJOR.MINOR.PATCH.CORRECTION` (MAJOR `0` until the user declares `1.0`). Build stamp `YYMM###`. Full rules: `knowledge/conventions/versioning.md`.
- **Changelog every publish**, categorized, with build + ISO-8601 UTC timestamp: `knowledge/conventions/changelog-and-releases.md`.
- **Knowledge-writing standard** (how to write/maintain these files): `knowledge/conventions/knowledge-writing-standard.md`.
- **Naming:** never hardcode user-facing strings arbitrarily; use canonical keys from the lexicon: `knowledge/conventions/naming-lexicon.md`.
- **Session coordination:** one PM, one infra and one topic session per piece of work (a topic builds it end to end on its own branch); specialists are subagents in `.claude/agents/` (design-ux-frontend is mandatory for any UI change); list your areas on the topic issue, overlapping topics run in sequence, shared hotspots land first with the PM's OK; use judgment and stop only for production, real people, new spend, a public store release or rewriting history. Take your seat (`seat take <role>`; lost? `whoami`), keep your checkpoint current, title yourself `<CODE> 🔸 <icon> <role or name>` outside FORGE. Detail loads from `coordination/CLAUDE.md`.
- **Sessions:** one **PM** (the user's single point of contact; keeps the board and the list of what waits on the user; accepts finished work), one **infra** (the only holder of production credentials), one **topic** session per piece of work (it builds its work end to end on `seat/topic-<slug>` and retires when merged). Who is who: `coordination/ROSTER.md`. Titles: `<CODE> 🔸 <icon> <role or name>`; on FORGE never rename a seat.
- **Specialists are subagents** in `.claude/agents/` (index there): design-ux-frontend (mandatory for any UI change), api, integrations, finance, canon, reviewer, and the Opus helpers planner, debugger and risk-reviewer on their triggers. The reviewer checks every topic before acceptance. Sonnet by default; log each Opus call as one line on the topic issue.
- **Conflicts between topics:** list the areas you will touch on the topic issue; overlapping topics run one after the other; shared hotspots land first as a small change the PM approves; others rebase. At most 2 to 3 topics are open.
- **Use judgment.** If instructions conflict, pick the sensible reading, note why, and carry on. Stop and ask only for production, anything that reaches real people, new spend, a public store release, and force pushes or deleting history.
- **Lost after a compaction?** `node scripts/coord.mjs whoami`, then your checkpoint (`coordination/BOOT.md`). On FORGE read `coordination/FORGE.md` first.

---

## Who is who

@coordination/ROSTER.md
---

## Knowledge index — read on demand (do NOT read all of these each session)

**Conventions / how we operate**
- [knowledge-writing-standard.md](knowledge/conventions/knowledge-writing-standard.md) — how to author & maintain knowledge files. READ WHEN: creating/editing any `knowledge/` file or `CLAUDE.md`.
- [partnership-contract.md](knowledge/conventions/partnership-contract.md) — full working-agreement & behavior rules. READ WHEN: unsure how to frame recommendations or handle suggestions.
- [versioning.md](knowledge/conventions/versioning.md) — version + build scheme, increment decision tree. READ WHEN: publishing, tagging, or deciding a bump.
- [changelog-and-releases.md](knowledge/conventions/changelog-and-releases.md) — changelog format, General vs Maintenance release, Release Notes. READ WHEN: writing a changelog entry or cutting a release.
- [docs-and-staleness.md](knowledge/conventions/docs-and-staleness.md) — per-change DoD + release staleness audit. READ WHEN: finishing a change or cutting a General Release.
- [naming-lexicon.md](knowledge/conventions/naming-lexicon.md) — ubiquitous language; canonical object names. READ WHEN: naming anything in code, DB, API, or UI.
- [initiatives.md](knowledge/conventions/initiatives.md) — how the Initiatives system works. READ WHEN: capturing, fleshing out, or completing an initiative.
- [code-documentation.md](knowledge/conventions/code-documentation.md) — code commenting standard. READ WHEN: writing or reviewing code.
- [session-coordination.md](knowledge/conventions/session-coordination.md) — the sessions, topics, subagents, seats, requests and handoffs between parallel sessions on GitHub Issues. READ WHEN: starting a session, opening a topic, needing something from another area, finishing work another area depends on, or taking over, leaving or proposing a role.
- [coordination/ROLES.md](coordination/ROLES.md) — the seats, who owns each area, naming, reporting and the role-proposals table. READ WHEN: posting a request, taking a seat, calling a specialist, or asking who owns an area.
- [coordination/PM.md](coordination/PM.md) — the PM's handbook: routine, topics, routing, meetings, proposals, limits. READ WHEN: holding or taking the PM seat, or running or joining a meeting.
- [coordination/SESSIONS.md](coordination/SESSIONS.md) — who reports to whom and when each session was last reachable. READ WHEN: a session has no seat, or the PM is checking who is accounted for.
- [coordination/BOOT.md](coordination/BOOT.md) — checkpoints, compaction, replacing a session, the boot prompt. READ WHEN: a session compacts, breaks or is replaced.
- [coordination/COMMS.md](coordination/COMMS.md) — how sessions message each other. READ WHEN: messaging another session or checking you can.
- [coordination/FORGE.md](coordination/FORGE.md) — running the sessions as FORGE seats: titles, parking, git, the gates, topics. READ WHEN: `$FORGE_SEAT` is set in your shell.
- [coordination/OPEN-LOOPS.md](coordination/OPEN-LOOPS.md) — every ask in flight. READ WHEN: holding the PM seat, or asking who owes what.
- [.claude/agents/README.md](.claude/agents/README.md) — the subagents, their models and the Opus triggers. READ WHEN: a topic needs a specialist part, a review or a plan.
- [docs/DECISIONS.md](docs/DECISIONS.md) — the decision log (D-NN) from meetings and rule reviews. READ WHEN: a meeting ended, or someone says "we agreed this".

**Architecture / the big picture**
- [hosting-and-deployment.md](knowledge/architecture/hosting-and-deployment.md) — Cloudflare hosting at inventory.jammin.cafe, API token scope & storage. READ WHEN: deploying, configuring Cloudflare/DNS, or handling the API token.
- [auth-and-users.md](knowledge/architecture/auth-and-users.md) — PIN login, sessions, roles, user table. READ WHEN: touching login, sessions, users, roles, or permission checks.
- [item-notes.md](knowledge/architecture/item-notes.md) — notes on item cards: 12-hour edit window, admin Acknowledge, history (design). READ WHEN: building notes or the Admin Notes review.
- [reminders.md](knowledge/architecture/reminders.md) — time-based one-time/recurring reminders for whoever is using the app that day (design). READ WHEN: building reminders or the Home screen.
- [scheduling-and-notifications.md](knowledge/architecture/scheduling-and-notifications.md) — scheduling people for inventory, alerts, emailed scoped login link, cron (design). READ WHEN: touching scheduling, notifications, emails, or magic links.
- [ui-design.md](knowledge/architecture/ui-design.md) — chosen layout (option A), Public Sans, mobile-first rules, prototype location. READ WHEN: building or styling any screen.
- [stock-counting.md](knowledge/architecture/stock-counting.md) — items, locations, vendors, Quick Inventory, counts, shopping lists (draft). READ WHEN: building items, locations, vendors, counts, current-stock or shopping-list logic.

**Decisions (ADRs)** — `knowledge/decisions/` — READ WHEN: revisiting *why* a foundational choice was made.

**Templates** — `knowledge/templates/` — changelog entry, release notes, ADR, release checklist, initiative.

---

## Repository map

- `CLAUDE.md` — this router.
- `Initiatives-Open.md` / `Initiatives-Complete.md` — idea backlog & history.
- `CHANGELOG.md` — every publish, categorized.
- `knowledge/` — the on-demand canon (conventions, architecture, decisions, templates).

> Status: Scaffolded and deployed (hello-world shell) at inventory.jammin.cafe. Stack: Worker + Hono + React/Vite + D1 (ADR-0003). Sign-in + admin Users live. Next: locations/racks/shelves/items admin, bulk placement, Quick Inventory, shopping lists.
