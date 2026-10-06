import { newPinRecord, nowIso, ulid } from "../worker/crypto.ts";
import { ROLES } from "../worker/permissions.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * SQL (one statement per line) that creates the FIRST admin with all three roles. The user insert does
 * nothing if any admin already exists, and the role inserts only match the new id, so re-running can't
 * create a second admin. The PIN is hashed here and never appears in the SQL.
 */
export async function buildSeedSql(displayName: string, pin: string, pepper: string): Promise<string> {
  const id = ulid();
  const now = nowIso();
  const rec = await newPinRecord(pin, id, pepper);
  return [
    `INSERT INTO user (id, display_name, pin_hash, pin_salt, pin_iterations, created_at, updated_at) ` +
      `SELECT ${q(id)}, ${q(displayName)}, ${q(rec.pin_hash)}, ${q(rec.pin_salt)}, ${rec.pin_iterations}, ${q(now)}, ${q(now)} ` +
      `WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role = 'admin');`,
    ...ROLES.map((r) => `INSERT INTO user_role (user_id, role) SELECT id, ${q(r)} FROM user WHERE id = ${q(id)};`),
  ].join("\n");
}
