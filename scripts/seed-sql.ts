import { newPinRecord, nowIso, ulid } from "../worker/crypto.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * One-line SQL that creates the FIRST admin. It inserts nothing if any admin already exists,
 * so re-running it can't create a second one. The PIN is hashed here and never appears in the SQL.
 */
export async function buildSeedSql(displayName: string, pin: string, pepper: string): Promise<string> {
  const id = ulid();
  const now = nowIso();
  const rec = await newPinRecord(pin, id, pepper);
  return (
    `INSERT INTO user (id, display_name, role, pin_hash, pin_salt, pin_iterations, created_at, updated_at) ` +
    `SELECT ${q(id)}, ${q(displayName)}, 'admin', ${q(rec.pin_hash)}, ${q(rec.pin_salt)}, ${rec.pin_iterations}, ${q(now)}, ${q(now)} ` +
    `WHERE NOT EXISTS (SELECT 1 FROM user WHERE role = 'admin');`
  );
}
