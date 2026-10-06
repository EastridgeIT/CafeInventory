// Secrets and test-only bindings that wrangler.jsonc does not declare.
// Declared twice because wrangler's generated types split them: the global `Env` (Worker code)
// and `Cloudflare.Env` (what `cloudflare:test` / `cloudflare:workers` expose to tests).
interface Env {
  /** `wrangler secret put PIN_PEPPER`; local value in .dev.vars. Rotating it invalidates every PIN. */
  PIN_PEPPER: string;
  TEST_MIGRATIONS: unknown;
}
declare namespace Cloudflare {
  interface Env {
    PIN_PEPPER: string;
    TEST_MIGRATIONS: unknown;
  }
}

// Lets tests import fixture files as text (Vite's ?raw).
declare module "*?raw" {
  const content: string;
  export default content;
}
