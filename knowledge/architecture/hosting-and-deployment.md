---
status: active
read-when: Deploying, configuring Cloudflare, touching DNS for inventory.jammin.cafe, or handling the Cloudflare API token.
related: [../decisions/0002-host-on-cloudflare.md]
updated: 2026-10-06
---

# Hosting & deployment

- **Host:** Cloudflare, at **`inventory.jammin.cafe`**. The `jammin.cafe` zone is already on Cloudflare (nameservers `garrett`/`gigi.ns.cloudflare.com`); `inventory` had no DNS record as of 2026-10-06.
- **Runtime:** Cloudflare Workers (with static assets) is the expected target; storage (D1 / KV / R2) is decided with the stack. Not final until the stack ADR.
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

### Rotation

Revoke in the Cloudflare dashboard (My Profile → API Tokens), create a replacement with the same permissions, re-run the `.envrc` write step. Never paste the token into a chat session.
