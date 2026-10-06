import { applyD1Migrations, env } from "cloudflare:test";

// Runs before each test file: bring the local test D1 to the current schema.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS as Parameters<typeof applyD1Migrations>[1]);
