---
status: active
read-when: Deploying, configuring Cloudflare, touching DNS for inventory.jammin.cafe, or handling the Cloudflare API token.
related: [../decisions/0002-host-on-cloudflare.md]
updated: 2026-10-06
---

# Hosting & deployment

- **Host:** Cloudflare, at **`inventory.jammin.cafe`**. The `jammin.cafe` zone is already on Cloudflare (nameservers `garrett`/`gigi.ns.cloudflare.com`); `inventory` had no DNS record as of 2026-10-06.
- **Runtime:** one Cloudflare Worker serving the API (`/api/*`) plus static assets (ADR-0003). **Live since 2026-10-06.** Worker `cafe-inventory`, D1 database `cafe-inventory` (binding `DB`, id in `wrangler.jsonc`), custom domain `inventory.jammin.cafe` (created by the deploy; no manual DNS needed).
- **Deploy tool:** `wrangler`, run via `npx wrangler` (not installed globally).

## API access (FORGE)

Uses the per-project credential-isolation pattern (`~/projects/FORGE/credential-hygiene.md`, section B), adapted for Cloudflare:

- **Scoped API token** (not the Global API Key, not `wrangler login` OAuth, which grants broad account access and persists machine-wide in `~/.config/.wrangler`).
- Stored in this repo's **`.envrc`** (gitignored, `chmod 600`), loaded by `direnv` only while inside this directory:
  - `CLOUDFLARE_API_TOKEN` — the token
  - `CLOUDFLARE_ACCOUNT_ID` — the account id (not secret, but kept alongside)
- `wrangler` reads both env vars automatically.

### Token permissions (least privilege)

| Scope | Permission | Why |
|---|---|---|
| Account | Workers Scripts: Edit | deploy the app |
| Account | D1: Edit | database (drop if stack doesn't use D1) |
| Account | Account Settings: Read | lets `wrangler whoami`/deploy resolve the account |
| Zone `jammin.cafe` only | Workers Routes: Edit | attach the custom domain |
| Zone `jammin.cafe` only | DNS: Edit | create the `inventory` record |

Account resources: **only the jammin.cafe account**. Zone resources: **only `jammin.cafe`**. Set an IP filter or TTL if wanted. Add permissions (KV, R2, Access) only when a feature needs them.

### Verify (never prints the token)

```bash
direnv exec . sh -c 'curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify' | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["success"], d["result"]["status"] if d.get("result") else d["errors"])'
direnv exec . npx -y wrangler whoami
```

**Verified 2026-10-06:** token `active`; account = the Eastridge Cloudflare account (`It@eastridgetoday.com's Account`, which also holds `eastridgechurch.net` and `eastridge.network`). Workers, D1, DNS and Workers Routes are reachable on `jammin.cafe`; DNS/routes on the other two zones are refused (error 10000), so zone scoping is correct. Those zones still show up in `/zones` listings, which is expected and grants nothing. `wrangler whoami` warns it can't read the user email (no `User Details: Read`); that's harmless and deliberately not granted.

## Day-to-day

```bash
direnv exec . npm run deploy              # build + wrangler deploy
direnv exec . npm run db:migrate:remote   # apply migrations to production D1
npm run dev                               # local dev (local D1 via miniflare)
npm test                                  # Vitest in the Workers runtime
```
After changing `wrangler.jsonc` bindings, run `npm run cf-typegen`. Keep `compatibility_date` no newer than the bundled workerd supports, or `npm test` fails to start (hit on 2026-10-06 with 2026-09-15; 2026-08-22 works).

### Secrets and first admin
- `PIN_PEPPER`: generated locally into `.dev.vars` (gitignored, `chmod 600`) and uploaded with `sed -n 's/^PIN_PEPPER=//p' .dev.vars | direnv exec . npx wrangler secret put PIN_PEPPER`. **Keep a copy in the password manager**: Cloudflare will not show a secret again, and losing it means every PIN must be reset. Rotating it also invalidates every PIN.
- Production migrations applied 2026-10-06 (`0001`, `0002`). Apply later ones with `npm run db:migrate:remote`.
- **First admin:** `direnv exec . npm run seed:admin -- --remote` in an interactive terminal. It prompts for a name and a hidden PIN, and sends only a salted hash. It does nothing if an admin already exists.

### Email (planned)
SMTP2GO via its HTTPS API; Worker secret `SMTP2GO_API_KEY` (set like `PIN_PEPPER`: value in `.dev.vars`, uploaded with `wrangler secret put`). Sender domain `jammin.cafe` verified with DNS records added through the Cloudflare API token. Details: `scheduling-and-notifications.md`.

### Rotation

Revoke in the Cloudflare dashboard (My Profile → API Tokens), create a replacement with the same permissions, re-run the `.envrc` write step. Never paste the token into a chat session.
