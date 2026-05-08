-- Append-only mirror of the HubSpot source data. Each row carries the
-- modification timestamp from the source so we can resolve "latest
-- version of object N" in staging via DISTINCT ON. Payload is the raw
-- HubSpot properties JSON — we don't lock the shape here, schema lives
-- in staging views.

CREATE TABLE IF NOT EXISTS raw_hubspot.companies (
  hs_object_id     bigint NOT NULL,
  hs_lastmodified  timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (hs_object_id, hs_lastmodified)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_companies_lastmodified
  ON raw_hubspot.companies (hs_lastmodified DESC);

CREATE TABLE IF NOT EXISTS raw_hubspot.deals (
  hs_object_id     bigint NOT NULL,
  hs_lastmodified  timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (hs_object_id, hs_lastmodified)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_deals_lastmodified
  ON raw_hubspot.deals (hs_lastmodified DESC);

CREATE TABLE IF NOT EXISTS raw_hubspot.line_items (
  hs_object_id     bigint NOT NULL,
  hs_lastmodified  timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (hs_object_id, hs_lastmodified)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_line_items_lastmodified
  ON raw_hubspot.line_items (hs_lastmodified DESC);

CREATE TABLE IF NOT EXISTS raw_hubspot.contacts (
  hs_object_id     bigint NOT NULL,
  hs_lastmodified  timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (hs_object_id, hs_lastmodified)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_contacts_lastmodified
  ON raw_hubspot.contacts (hs_lastmodified DESC);

CREATE TABLE IF NOT EXISTS raw_hubspot.engagements (
  hs_object_id     bigint NOT NULL,
  hs_lastmodified  timestamptz NOT NULL,
  ingested_at      timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  PRIMARY KEY (hs_object_id, hs_lastmodified)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_engagements_lastmodified
  ON raw_hubspot.engagements (hs_lastmodified DESC);

-- HubSpot models Deal→Company and Deal→Line-Item relationships in a
-- separate Associations API rather than as fields on the deal record.
-- We mirror the associations explicitly so staging joins are SQL-native.

CREATE TABLE IF NOT EXISTS raw_hubspot.assoc_deal_company (
  deal_id     bigint NOT NULL,
  company_id  bigint NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_assoc_deal_company_company
  ON raw_hubspot.assoc_deal_company (company_id);

CREATE TABLE IF NOT EXISTS raw_hubspot.assoc_deal_line_item (
  deal_id      bigint NOT NULL,
  line_item_id bigint NOT NULL,
  ingested_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deal_id, line_item_id)
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_assoc_deal_line_item_line_item
  ON raw_hubspot.assoc_deal_line_item (line_item_id);
