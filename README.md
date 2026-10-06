# Cafe Inventory

> **Effortless for volunteers; timely for procurement.**

A stock tracker for the Eastridge cafe. Volunteers record deliveries, usage, and stock counts quickly; the Cafe Manager gets timely, trustworthy stock levels and knows what to reorder.

## Status

Scaffolded and deployed (hello-world shell) at https://inventory.jammin.cafe. Sign-in and admin user management are live; the inventory database schema is in place. Item/location setup, counting and shopping lists are next.

## How this repo is developed

AI-co-developed against a **containerized knowledge base** — a thin router (`CLAUDE.md`) plus many small, on-demand docs. The goal is to keep always-loaded AI context minimal while never losing rigor.

| Path | What |
|---|---|
| `CLAUDE.md` | Router: vision, partnership contract, knowledge index |
| `knowledge/conventions/` | How we work: versioning, changelog, naming, docs & code standards |
| `knowledge/architecture/` | The big-picture design |
| `knowledge/decisions/` | ADRs — *why* each foundational choice was made |
| `knowledge/templates/` | Fill-in scaffolds for ADRs, changelog entries, releases, initiatives |
| `Initiatives-Open.md` / `Initiatives-Complete.md` | Idea backlog & shipped history |
| `CHANGELOG.md` | Every publish, categorized |
