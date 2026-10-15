---
status: active
read-when: Starting a session, asking who owns an area, calling a specialist, proposing a role, or checking what the PM does.
related: [PM.md, ROSTER.md, SESSIONS.md, FORGE.md, ../.claude/agents/README.md, ../docs/DECISIONS.md, ../knowledge/conventions/session-coordination.md]
updated: 2026-10-15
---

# Roles

Cafe Inventory runs on three kinds of session (set on 2026-10-15): the **PM**, **infra**, and one **topic** session per piece of work. The specialist roles are **subagents** in `.claude/agents/` (index: `.claude/agents/README.md`): a topic calls one for a specialist part, it returns a written result and stops. A request addressed to a specialist goes to the PM, who assigns it to a topic.

## Sessions (seats)

A seat is a standing job. Any session can hold one by running `node scripts/coord.mjs seat take <id>`; a new session can take it over later, so names never need to persist. Topics are not seats: each is a session and an issue (`ROSTER.md`).

| id | owns | notes |
|---|---|---|
| `pm` | no code; open topics, the board, check-ins, meetings, `docs/DECISIONS.md`, `coordination/` | The user's single point of contact. Handbook: `PM.md`. |
| `infra` | deploys, Cloudflare hosting and DNS, D1 migrations applied to production, environment config, root config | The only session holding production credentials; carries out production steps once approved (on FORGE, through the gatekeeper). Parks when idle on FORGE. |

## Who owns each area

An area's owner is the one who knows it best and the one the topic calls for it. It is not a lane: any topic may change any area, under the conflict rules in `ROSTER.md`. The subagent for an area must be called when a topic changes it (the design subagent is mandatory for any UI change). Design (how it looks and feels, on every surface) and function (how it is built and works) stay separate jobs: the look goes through the design subagent, the behavior through the one that owns the surface's code.

| Owner | Areas |
|---|---|
| design-ux-frontend (subagent) | `src/` (React screens, `styles.css`, `Nav.tsx`, `nav.ts`), `public/`, `index.html`, `design/` (mockups), `knowledge/architecture/ui-design.md` |
| api (subagent) | `worker/` (Hono API, auth, permissions, catalog), `migrations/` (D1 schema), `scripts/seed-*.ts`, `scripts/import-*.ts`, `data/`, `test/` |
| integrations (subagent) | outside services: SMTP2GO email (scheduled counts, magic links), Cloudflare cron; `knowledge/architecture/scheduling-and-notifications.md` |
| finance (subagent) | costs of Cloudflare and SMTP2GO plans and any paid service; no cost files yet |
| canon (subagent) | `knowledge/`, `CLAUDE.md`, `README.md`, `Initiatives-Open.md`, `Initiatives-Complete.md`, `CHANGELOG.md` |
| infra (session) | `wrangler.jsonc`, `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `.gitignore`, `.envrc` (never committed), deploy and Cloudflare config, `scripts/coord.mjs`, `scripts/coord.test.mjs` |
| pm (session) | no code; `coordination/`, `docs/DECISIONS.md`, the board |

**Shared and unlisted paths.** Paths that fit no single row above, or that two could claim. The project fills this in; the PM adds a line the day one is settled. A new path that fits none is the PM's to assign.

| Path | Owner | Note |
|---|---|---|
| | | |

**Shared hotspots** (changed as a small change landed first and approved by the PM; every other open topic then rebases): the database schema and migrations (`migrations/`), API contracts (`worker/`), design tokens (`src/styles.css`), root config (`package.json`, `wrangler.jsonc`), canon and the router (`knowledge/`, `CLAUDE.md`)

**Naming:** every session is titled `<CODE> 🔸 <icon> <role or name>`, where `<CODE>` is the project's short code: `<CODE> 🔸 🧑‍💼 PM`, `<CODE> 🔸 🛠️ infra`, `<CODE> 🔸 🔵 <Topic name>`. The icons: 🧑‍💼 the PM, 🛠️ a standing role, 🔵 a topic, ⚪ a session with no seat and no topic (it reports to the PM). On FORGE, FORGE sets the title and seats never rename, because renaming changes the message address (`FORGE.md`). Outside FORGE, a session sets its own title in this form when it starts, with no job text in it. A title that does not match is a mismatch the PM reports.

**Reachability:** every session of the project accepts direct messages from the other sessions of the project, and can send them, always, in addition to the Issues; the PM above all. Message a session by its address (`ROSTER.md`), never by name. Bidirectional is never switched off between sessions of the same project. See `PM.md`, Reachability.

**Reporting:** a session without a seat reports to the PM. Every topic and `infra` report to the PM, and through it to the user.

A request goes to the topic that owns the work; if none does, to the PM, who assigns it.

## The PM

The handbook, with the routine, the sources and the limits, is [`PM.md`](PM.md); this is the summary. The PM keeps a high-level awareness of everything the project is trying to accomplish (the goals, the checklist if there is one, the user's current priorities) and uses it to keep topics moving.

It does:
- keep the board: read every topic issue and the seats, and say what is blocked, stale, duplicated or waiting on the user;
- open topics, list the areas each will touch, order overlapping topics one after the other, and approve each small change to a shared hotspot;
- accept finished work against the topic's acceptance criteria, after the `reviewer` (and, where `ROSTER.md` says so, the `risk-reviewer`) has checked it;
- report to the user in plain words: what moved, what is stuck, what needs their decision, in the order of the goals they have set; and keep the list of everything waiting on them;
- keep the master checklist true, if the project has one: move a status only on evidence.

It does not:
- build topics' work, take over their claims or edit their files;
- decide anything (the user decides), re-prioritize on its own, or say an item is done on a hunch;
- authorize a deploy, a publish or any touch of production; those need the user, through `infra`.

Its authority is attention and routing, never command: a topic can answer "not now" with a reason. Its memory is its checkpoint, like every session.

## Role proposals

The user approves, defers or denies each new role; nothing is created silently. A new specialist is a subagent in `.claude/agents/`, not a seat. The PM recommends one when work appears that no subagent fits, or one is overloaded (`node scripts/coord.mjs proposal post --role <id> --title <why> --body <owns, trigger, cost of leaving it undone>`), and the user decides (`proposal decide <n> --as approve|defer|deny --note <t>`). A deferred or approved-but-waiting role stays in the table below with the trigger that would bring it in; a denied one stays too, so it is not proposed again without new reason. An approved subagent gets, in one change: its file in `.claude/agents/`, a row in `.claude/agents/README.md`, a row in the owner table above and in `ROSTER.md`. An approved seat gets a row in the seats table above, `seat init <id>` and a session to take it.

| Role | Status | Date | Trigger / reason |
|---|---|---|---|
| `data` | Deferred | 2026-10-15 | Migrations get heavy, or two topics collide on migrations. |
| `security` | Deferred | 2026-10-15 | Before real user data at scale, or a compliance need. |
| `release` | Deferred | 2026-10-15 | Before the first tagged release others will use. |
| `qa` | Deferred | 2026-10-15 | Bugs are found by users instead of tests. |
