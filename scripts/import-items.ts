// Loads the item list: data/item-import-draft.csv + data/item-variants-draft.csv.
//   direnv exec . node scripts/import-items.ts            # local dev database
//   direnv exec . node scripts/import-items.ts --remote   # production
// Re-runnable: items that already exist are skipped. Everything comes in as a draft ("Needs setup").
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildImportSql } from "./import-sql.ts";

const remote = process.argv.includes("--remote");
const sql = buildImportSql(readFileSync("data/item-import-draft.csv", "utf8"), readFileSync("data/item-variants-draft.csv", "utf8"));
const file = join(tmpdir(), `import-items-${process.pid}.sql`);
writeFileSync(file, sql, { mode: 0o600 });
try {
  const args = ["wrangler", "d1", "execute", "cafe-inventory", remote ? "--remote" : "--local", `--file=${file}`];
  if (remote) args.push("--yes");
  const r = spawnSync("npx", args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error("wrangler d1 execute failed (see output above).");
  console.log(`\nImported ${sql.split("\n").length} statements (${remote ? "production" : "local"}).`);
} finally {
  rmSync(file, { force: true });
}
