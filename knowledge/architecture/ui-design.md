---
status: active
read-when: Building or restyling any screen; choosing fonts, colors, spacing, or layout patterns.
related: [stock-counting.md, ../decisions/0003-stack.md]
updated: 2026-10-06
---

# UI design

Prototype of record: `design/layout-options.html` (also a private artifact). Decisions are the user's, 2026-10-06.

- **Direction:** option **A, "Guided card"**, is the volunteer counting layout: one item at a time, big type, big buttons, Back/Skip. Option B's whole-shelf list is a possible "See whole shelf" view later; option C (rack map) is deferred.
- **Typeface:** **Public Sans**, for all UI text. Self-hosted through `@fontsource-variable/public-sans` (imported in `src/main.tsx`), not loaded from Google, so it works offline and sends no third-party requests. Single stack in `--font-ui` (`src/styles.css`); change it there. Tabular numerals are on globally so counts line up.
- **Mobile first:** single column and large touch targets by default (minimum 44 px, buttons 46 to 60 px); wider breakpoints (about 900 px) add columns and tables. Admin screens are desktop-first but must work on a phone.
- **Themes:** light and dark, following the system setting, defined as color tokens.
- **Count card rules** (buttons, "Last update", Reset, date format) live in `stock-counting.md`.
