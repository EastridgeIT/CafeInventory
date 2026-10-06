// Creates the first admin. Run in YOUR terminal (it prompts for the PIN with hidden input):
//   direnv exec . npm run seed:admin              # local dev database
//   direnv exec . npm run seed:admin -- --remote  # production
// The PIN never goes on a command line or into a file: only its salted hash is sent to D1.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { PIN_PATTERN } from "../worker/crypto.ts";
import { buildSeedSql } from "./seed-sql.ts";

const remote = process.argv.includes("--remote");

function pepper(): string {
  if (process.env.PIN_PEPPER) return process.env.PIN_PEPPER;
  if (existsSync(".dev.vars")) {
    const m = readFileSync(".dev.vars", "utf8").match(/^PIN_PEPPER=(.+)$/m);
    if (m?.[1]) return m[1].trim();
  }
  throw new Error("PIN_PEPPER not found. It must be in .dev.vars (the same value as the Worker secret).");
}

function readHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  let buf = "";
  return new Promise((resolve) => {
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === "\u0003") process.exit(130);
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(buf);
        }
        buf = c === "\u007f" ? buf.slice(0, -1) : buf + c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  if (!process.stdin.isTTY) throw new Error("Run this in an interactive terminal (it needs to prompt for the PIN).");
  const key = pepper();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const name = (await rl.question("Admin display name: ")).trim();
  rl.close();
  if (!name) throw new Error("A name is required.");
  const pin = await readHidden("PIN (4-8 digits): ");
  if (!PIN_PATTERN.test(pin)) throw new Error("The PIN must be 4 to 8 digits.");
  if ((await readHidden("Repeat PIN: ")) !== pin) throw new Error("The PINs did not match.");

  const file = join(tmpdir(), `seed-admin-${process.pid}.sql`);
  writeFileSync(file, await buildSeedSql(name, pin, key), { mode: 0o600 });
  try {
    const args = ["wrangler", "d1", "execute", "cafe-inventory", remote ? "--remote" : "--local", `--file=${file}`];
    if (remote) args.push("--yes");
    const r = spawnSync("npx", args, { stdio: "inherit" });
    if (r.status !== 0) throw new Error("wrangler d1 execute failed (see output above).");
  } finally {
    rmSync(file, { force: true });
  }
  console.log(`\nDone. If no admin existed, "${name}" can now sign in. (If one already existed, nothing was changed.)`);
}

main().catch((e) => {
  console.error(`\n${e.message}`);
  process.exit(1);
});
