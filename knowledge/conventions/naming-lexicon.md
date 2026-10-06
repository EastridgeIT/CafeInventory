---
status: active
read-when: Naming anything in code, database, API, or UI.
related: []
updated: 2026-10-06
---

# Naming lexicon (ubiquitous language)

**One canonical key per concept**, used identically in code, DB, and API. Intentional naming is a hard requirement — no synonyms proliferating. Separate concerns ruthlessly (e.g. **physical** vs **logical**). This file is the source of truth for the canonical terms.

## Canonical terms

| Concept | Default label (`key`) | Notes / avoid |
|---|---|---|
| _<concept>_ | **_<Label>_** (`_key_`) | _<synonyms to avoid; disambiguation notes>_ |

> Fill this table as the domain model solidifies. Terms that are easy to conflate should carry an explicit "never interchange" note.

## Identity rule
Everything is identified internally by **opaque, stable IDs** (e.g. UUIDv7/ULID), never by a user-chosen name. Names/labels are mutable attributes. This is what makes rename, re-parent, and swap-upgrade safe.

## Canonical keys, not display strings
Code/DB/API reference stable **canonical keys**, never display strings. If the product needs tenant-renamable labels or i18n, resolve keys → labels through a terminology layer (record that as an ADR). Building this from day one keeps every user-facing string swappable.
