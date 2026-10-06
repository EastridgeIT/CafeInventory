-- Catalog: item categories, variants (sizes/packages of one item), markout flag, draft status, backstock, and the Undelivered system place.
-- Design: knowledge/architecture/stock-counting.md (Variants, Found stock, Markouts).
ALTER TABLE item ADD COLUMN category TEXT;
ALTER TABLE item ADD COLUMN ask_markout INTEGER NOT NULL DEFAULT 0 CHECK (ask_markout IN (0, 1));
ALTER TABLE item ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1));  -- draft: not in Quick Inventory until an Admin completes setup
ALTER TABLE item ADD COLUMN buy_variant_id TEXT;    -- preferred variant to buy (null = item has no variants)
ALTER TABLE item ADD COLUMN count_variant_id TEXT;  -- preferred variant to count
CREATE UNIQUE INDEX item_name_uq ON item (lower(name));

-- A size or package of one item. equals_base_units is how many of the item's unit_label ("base unit") it equals; null = not yet known.
CREATE TABLE item_variant (
  id                TEXT PRIMARY KEY,
  item_id           TEXT NOT NULL REFERENCES item (id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  equals_base_units REAL CHECK (equals_base_units IS NULL OR equals_base_units > 0),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE UNIQUE INDEX item_variant_name_uq ON item_variant (item_id, lower(name));

ALTER TABLE item_location ADD COLUMN is_backstock INTEGER NOT NULL DEFAULT 0 CHECK (is_backstock IN (0, 1));
CREATE UNIQUE INDEX item_location_backstock_uq ON item_location (item_id) WHERE is_backstock = 1;

ALTER TABLE location ADD COLUMN kind TEXT NOT NULL DEFAULT 'normal' CHECK (kind IN ('normal', 'undelivered'));
-- The one system place that holds bought-but-not-shelved stock. Cannot be renamed, deactivated or counted.
INSERT INTO location (id, name, sort_order, kind) VALUES ('UNDELIVERED', 'Undelivered', 9999, 'undelivered');
