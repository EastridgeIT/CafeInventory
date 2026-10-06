import { nowIso, ulid } from "../worker/crypto.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Minimal CSV parser (quotes, commas inside quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c !== "")) rows.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((c) => c !== "")) rows.push(row); }
  const head = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/**
 * One SQL statement per line (D1 exec). Safe to run twice: existing items (by name, ignoring case) are skipped.
 * Every imported item is a draft (needs_review = 1) until an Admin completes setup. Unknown conversions stay null.
 */
export function buildImportSql(itemsCsv: string, variantsCsv: string): string {
  const items = parseCsv(itemsCsv);
  const variants = parseCsv(variantsCsv);
  const now = nowIso();
  const out: string[] = [];
  for (const it of items) {
    const quick = it.quick_max ? Number(it.quick_max) : null;
    out.push(
      `INSERT INTO item (id, name, category, unit_label, measurement_method, quick_max, in_quick_inventory, ask_markout, needs_review, created_at, updated_at) ` +
        `SELECT ${q(ulid())}, ${q(it.name!)}, ${q(it.category!)}, ${q(it.base_unit!)}, ${q(it.measurement!)}, ${quick ?? "NULL"}, 1, ${it.ask_markout === "1" ? 1 : 0}, 1, ${q(now)}, ${q(now)} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM item WHERE lower(name) = lower(${q(it.name!)}));`,
    );
  }
  const order = new Map<string, number>();
  for (const v of variants) {
    const n = order.get(v.item!) ?? 0;
    order.set(v.item!, n + 1);
    const eq = Number(v.equals_base_units);
    const equals = v.equals_base_units && Number.isFinite(eq) && eq > 0 ? String(eq) : "NULL";
    out.push(
      `INSERT INTO item_variant (id, item_id, name, equals_base_units, sort_order) SELECT ${q(ulid())}, i.id, ${q(v.variant!)}, ${equals}, ${n} FROM item i ` +
        `WHERE lower(i.name) = lower(${q(v.item!)}) AND NOT EXISTS (SELECT 1 FROM item_variant x WHERE x.item_id = i.id AND lower(x.name) = lower(${q(v.variant!)}));`,
    );
  }
  for (const name of order.keys()) {
    const rows = variants.filter((v) => v.item === name);
    const buy = rows.find((v) => v.preferred_to_buy === "yes") ?? rows[0]!;
    const cnt = rows.find((v) => v.preferred_to_count === "yes") ?? rows[0]!;
    const pick = (variant: string) => `(SELECT id FROM item_variant WHERE item_id = item.id AND lower(name) = lower(${q(variant)}))`;
    out.push(`UPDATE item SET buy_variant_id = ${pick(buy.variant!)}, count_variant_id = ${pick(cnt.variant!)} WHERE lower(name) = lower(${q(name)}) AND buy_variant_id IS NULL;`);
  }
  return out.join("\n");
}
