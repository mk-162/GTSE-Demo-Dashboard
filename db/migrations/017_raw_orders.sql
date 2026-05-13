-- HubSpot Orders are the actual transaction records (74k+ for GTSE)
-- imported from their upstream order systems (NetSuite + BigCommerce
-- where applicable). This is the data that lets the dashboard compute
-- real revenue, cadence, and lapse — replacing the Deals-based path
-- which only captured 323 sales-rep-tracked pipeline records.
--
-- See lib/ingest/pull-orders.ts and pull-order-associations.ts.

CREATE TABLE IF NOT EXISTS raw_hubspot.orders (
  hs_object_id     bigint NOT NULL,
  hs_lastmodified  timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (hs_object_id, hs_lastmodified)
);
CREATE INDEX IF NOT EXISTS idx_raw_orders_lastmodified
  ON raw_hubspot.orders (hs_lastmodified DESC);

CREATE TABLE IF NOT EXISTS raw_hubspot.assoc_order_company (
  order_id    bigint NOT NULL,
  company_id  bigint NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_assoc_order_company_company
  ON raw_hubspot.assoc_order_company (company_id);
