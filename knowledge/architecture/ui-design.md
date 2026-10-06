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

## Main menu (user, 2026-10-06; built: `src/nav.ts`, `src/Nav.tsx`)
- **Phone: a tab bar fixed across the bottom** (icon over label, at least 56 px tall, safe-area padding for the home indicator; content scrolls clear of it). **Desktop (900 px and wider): a side menu** on the left. Resizing swaps between them live.
- **Items by permission** (roles stack, so the menu is the union): Home (everyone) · Count (`inventory.count`) · Shop (`shopping.use`) · Check in (`inventory.checkin`) · Rebalance (`inventory.rebalance`) · Admin (any admin permission). Direct URLs to a section the user can't use go to Home; the server enforces separately.
- **Five slots on a phone.** With more than five items the fifth slot becomes **More**, a bottom sheet with the rest (Escape or the scrim closes it). The current item is marked (`aria-current="page"`); Admin sub-pages such as Users keep Admin (or More) marked. Sign out stays in the header.
- Adding a screen means adding one entry to `NAV` in `src/nav.ts` (with the permissions that see it); the bar, More sheet, side menu and tests follow from that list.

## Home (user, 2026-10-06)
**Home is where reminders appear** (`knowledge/architecture/reminders.md`): a Reminders section at the top, listing what is due now with its check box, or the line **"No reminders due."** when nothing is. Home no longer carries shortcut cards; the main menu is the way to every section. Built so far: the section and its empty state; reminders themselves are not built yet.

