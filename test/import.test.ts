import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import itemsCsv from "../data/item-import-draft.csv?raw";
import variantsCsv from "../data/item-variants-draft.csv?raw";
import { buildImportSql, parseCsv } from "../scripts/import-sql";
import { resetDb } from "./helpers";

beforeEach(resetDb);
const run = (sql: string) => env.DB.exec(sql);
const one = <T>(sql: string) => env.DB.prepare(sql).first<T>();

describe("csv parsing", () => {
  it("handles quotes, commas inside quotes and CRLF", () => {
    const rows = parseCsv('name,notes\r\n"Milk, Whole","say ""hi"""\r\nPlain,\r\n');
    expect(rows).toEqual([{ name: "Milk, Whole", notes: 'say "hi"' }, { name: "Plain", notes: "" }]);
  });
});

describe("item import", () => {
  it("loads all 66 items as drafts, with the 13 variant items and their variants", async () => {
    await run(buildImportSql(itemsCsv, variantsCsv));
    expect((await one<{ n: number }>("SELECT count(*) n FROM item"))?.n).toBe(66);
    expect((await one<{ n: number }>("SELECT count(*) n FROM item WHERE needs_review = 1"))?.n).toBe(66);
    expect((await one<{ n: number }>("SELECT count(DISTINCT item_id) n FROM item_variant"))?.n).toBe(13);
    expect((await one<{ n: number }>("SELECT count(*) n FROM item_variant"))?.n).toBe(26);
  });

  it("is safe to run twice", async () => {
    const sql = buildImportSql(itemsCsv, variantsCsv);
    await run(sql);
    await run(buildImportSql(itemsCsv, variantsCsv));
    expect((await one<{ n: number }>("SELECT count(*) n FROM item"))?.n).toBe(66);
    expect((await one<{ n: number }>("SELECT count(*) n FROM item_variant"))?.n).toBe(26);
  });

  it("gets the details right: milk variants and preferences, unknown conversions, level items, markouts", async () => {
    await run(buildImportSql(itemsCsv, variantsCsv));
    const milk = await one<{ id: string; unit_label: string; quick_max: number; buy: string; cnt: string }>(
      "SELECT i.id, i.unit_label, i.quick_max, (SELECT name FROM item_variant WHERE id = i.buy_variant_id) buy, (SELECT name FROM item_variant WHERE id = i.count_variant_id) cnt FROM item i WHERE name = 'Milk, Whole'",
    );
    expect(milk).toMatchObject({ unit_label: "gallons", quick_max: 6, buy: "Gallon", cnt: "Gallon" });
    const half = await env.DB.prepare("SELECT equals_base_units e FROM item_variant WHERE item_id = ? AND name = 'Half Gallon'").bind(milk!.id).first<{ e: number }>();
    expect(half?.e).toBe(0.5);
    const caseV = await env.DB.prepare("SELECT v.equals_base_units e FROM item_variant v JOIN item i ON i.id = v.item_id WHERE i.name = 'Hot Cups, 12oz' AND v.name = 'Case'").first<{ e: number | null }>();
    expect(caseV?.e).toBeNull();
    const cups = await one<{ buy: string; cnt: string }>("SELECT (SELECT name FROM item_variant WHERE id = i.buy_variant_id) buy, (SELECT name FROM item_variant WHERE id = i.count_variant_id) cnt FROM item i WHERE name = 'Hot Cups, 12oz'");
    expect(cups).toEqual({ buy: "Case", cnt: "Sleeve" });
    expect((await one<{ n: number }>("SELECT count(*) n FROM item WHERE measurement_method = 'level'"))?.n).toBe(28);
    expect((await one<{ n: number }>("SELECT count(*) n FROM item WHERE ask_markout = 1"))?.n).toBe(6);
    expect((await one<{ n: number }>("SELECT count(*) n FROM item WHERE name = 'Bagels, Cheese'"))?.n).toBe(1); // typo "Bagles" fixed
    expect((await one<{ n: number }>("SELECT count(*) n FROM item WHERE name = 'Syrup, SF Hazelnut (750mL Bottle)'"))?.n).toBe(1);
  });

  it("does not overwrite items that already exist or were edited", async () => {
    await run(buildImportSql(itemsCsv, variantsCsv));
    await env.DB.prepare("UPDATE item SET par_level = 9, needs_review = 0 WHERE name = 'Straws (box)'").run();
    await run(buildImportSql(itemsCsv, variantsCsv));
    expect(await one("SELECT par_level, needs_review FROM item WHERE name = 'Straws (box)'")).toEqual({ par_level: 9, needs_review: 0 });
  });
});
