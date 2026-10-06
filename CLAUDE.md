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

**Architecture / the big picture**
- [hosting-and-deployment.md](knowledge/architecture/hosting-and-deployment.md) — Cloudflare hosting at inventory.jammin.cafe, API token scope & storage. READ WHEN: deploying, configuring Cloudflare/DNS, or handling the API token.
- [auth-and-users.md](knowledge/architecture/auth-and-users.md) — PIN login, sessions, roles, user table. READ WHEN: touching login, sessions, users, roles, or permission checks.
- [stock-counting.md](knowledge/architecture/stock-counting.md) — items, locations, vendors, Quick Inventory, counts, shopping lists (draft). READ WHEN: building items, locations, vendors, counts, current-stock or shopping-list logic.

**Decisions (ADRs)** — `knowledge/decisions/` — READ WHEN: revisiting *why* a foundational choice was made.

**Templates** — `knowledge/templates/` — changelog entry, release notes, ADR, release checklist, initiative.

---

## Repository map

- `CLAUDE.md` — this router.
- `Initiatives-Open.md` / `Initiatives-Complete.md` — idea backlog & history.
- `CHANGELOG.md` — every publish, categorized.
- `knowledge/` — the on-demand canon (conventions, architecture, decisions, templates).

> Status: Scaffolded and deployed (hello-world shell) at inventory.jammin.cafe. Stack: Worker + Hono + React/Vite + D1 (ADR-0003). Next: D1 schema + PIN login.
