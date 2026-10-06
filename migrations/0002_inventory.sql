-- Items, places, vendors, counts, purchases. Design: knowledge/architecture/stock-counting.md.

CREATE TABLE location (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE UNIQUE INDEX location_name_uq ON location (lower(name));

CREATE TABLE rack (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES location (id),
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shelf (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES location (id),
  rack_id     TEXT REFERENCES rack (id),      -- null for locations without racks
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0      -- top to bottom
);

CREATE TABLE item (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  unit_label          TEXT NOT NULL DEFAULT 'each',
  measurement_method  TEXT NOT NULL DEFAULT 'whole' CHECK (measurement_method IN ('whole', 'decimal', 'level')),
  quick_max           INTEGER CHECK (quick_max IS NULL OR quick_max BETWEEN 1 AND 24),
  par_level           REAL CHECK (par_level IS NULL OR par_level >= 0),
  level_threshold     TEXT NOT NULL DEFAULT 'low' CHECK (level_threshold IN ('under_half', 'low')),
  in_quick_inventory  INTEGER NOT NULL DEFAULT 1 CHECK (in_quick_inventory IN (0, 1)),
  active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  CHECK (quick_max IS NULL OR measurement_method = 'whole'),
  -- "More than quick_max" must never hide a reorder (design rule).
  CHECK (quick_max IS NULL OR par_level IS NULL OR quick_max >= par_level)
);

-- "Where will I find this?": an item's presence in a location, optionally on a shelf.
CREATE TABLE item_location (
  item_id     TEXT NOT NULL REFERENCES item (id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES location (id),
  shelf_id    TEXT REFERENCES shelf (id),
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, location_id)
);

CREATE TABLE vendor (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('online', 'in_store')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE UNIQUE INDEX vendor_name_uq ON vendor (lower(name));

CREATE TABLE item_vendor (
  item_id    TEXT NOT NULL REFERENCES item (id) ON DELETE CASCADE,
  vendor_id  TEXT NOT NULL REFERENCES vendor (id),
  preference INTEGER NOT NULL DEFAULT 1,      -- 1 = preferred
  PRIMARY KEY (item_id, vendor_id)
);

-- Append-only, except voiding ("Reset this count"): a voided count behaves as if it never existed.
-- Read through active_stock_count, never this table, for any business logic.
CREATE TABLE stock_count (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES item (id),
  location_id TEXT NOT NULL REFERENCES location (id),
  quantity    REAL CHECK (quantity IS NULL OR quantity >= 0),
  level       TEXT CHECK (level IN ('full', 'over_half', 'under_half', 'low', 'out')),
  is_minimum  INTEGER NOT NULL DEFAULT 0 CHECK (is_minimum IN (0, 1)),  -- "More than X": quantity is a lower bound
  counted_by  TEXT NOT NULL REFERENCES user (id),
  counted_at  TEXT NOT NULL,
  voided_at   TEXT,
  voided_by   TEXT REFERENCES user (id),
  void_reason TEXT,
  CHECK ((quantity IS NOT NULL) + (level IS NOT NULL) = 1),
  CHECK (is_minimum = 0 OR quantity IS NOT NULL),
  CHECK ((voided_at IS NULL) = (voided_by IS NULL))
);
CREATE INDEX stock_count_lookup_idx ON stock_count (item_id, location_id, counted_at);
CREATE VIEW active_stock_count AS SELECT * FROM stock_count WHERE voided_at IS NULL;

CREATE TABLE purchase (
  id           TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES item (id),
  vendor_id    TEXT NOT NULL REFERENCES vendor (id),
  quantity     REAL NOT NULL CHECK (quantity > 0),
  status       TEXT NOT NULL CHECK (status IN ('ordered', 'bought')),
  by_user      TEXT NOT NULL REFERENCES user (id),
  purchased_at TEXT NOT NULL
);
