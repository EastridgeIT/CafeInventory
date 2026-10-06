# ADR 0002 — Host on Cloudflare at inventory.jammin.cafe

**Status:** Accepted · 2026-10-06
**Related:** `knowledge/architecture/hosting-and-deployment.md`

## Context
The app needs a public home that volunteers can reach from their phones and that costs the cafe little or nothing to run. The `jammin.cafe` domain is already managed on Cloudflare.

## Decision
Host Cafe Inventory on Cloudflare at `inventory.jammin.cafe`, deployed with `wrangler` using a least-privilege API token scoped to the jammin.cafe account and zone. The exact runtime (Workers with static assets expected) and storage are decided with the stack.

## Consequences
- (+) Same provider as the existing DNS, so no domain migration. Free tier likely covers a single cafe's load. Fast at the edge for mobile volunteers.
- (+) Cloudflare Access is available for low-friction auth (e.g. email one-time PIN), if wanted.
- (−) Pushes the stack toward the Workers runtime (no long-running Node server or native modules). D1 is SQLite-flavoured with its own limits.
- (−) One more credential to manage and rotate.

## Alternatives considered
- **Self-host on FORGE / a VM** — full control, but adds uptime, TLS and exposure work for a volunteer tool.
- **Other PaaS (Vercel, Netlify, Fly)** — viable, but the domain already lives on Cloudflare.
