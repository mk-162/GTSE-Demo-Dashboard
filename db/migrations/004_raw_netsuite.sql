-- Append-only mirror of NetSuite source data. Same DISTINCT-ON-by-modified
-- pattern as raw_hubspot; payload holds the raw SuiteQL row, schema lives
-- in staging views. inventory_snapshots is point-in-time rather than
-- record-versioned (each cron run writes a fresh snapshot row per item ×
-- location).

CREATE TABLE IF NOT EXISTS raw_netsuite.customers (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_customers_lastmodified
  ON raw_netsuite.customers (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.items (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_items_lastmodified
  ON raw_netsuite.items (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.sales_orders (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_sales_orders_lastmodified
  ON raw_netsuite.sales_orders (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.purchase_orders (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_purchase_orders_lastmodified
  ON raw_netsuite.purchase_orders (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.vendors (
  internal_id      bigint NOT NULL,
  last_modified    timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (internal_id, last_modified)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_vendors_lastmodified
  ON raw_netsuite.vendors (last_modified DESC);

CREATE TABLE IF NOT EXISTS raw_netsuite.inventory_snapshots (
  snapshot_at         timestamptz NOT NULL,
  item_internal_id    bigint NOT NULL,
  location_id         bigint NOT NULL,
  quantity_on_hand    numeric NOT NULL,
  quantity_available  numeric,
  payload             jsonb,
  PRIMARY KEY (snapshot_at, item_internal_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_netsuite_inventory_item_recent
  ON raw_netsuite.inventory_snapshots (item_internal_id, snapshot_at DESC);
