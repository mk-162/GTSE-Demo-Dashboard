-- staging.customer.id was built with `lpad(hs_object_id::text, 6, '0')`
-- on the theory that hs_object_id would fit in 6 digits and the lpad
-- would zero-pad shorter IDs for human readability (`co_uk_000123`).
-- That assumption held against mock data but breaks against real
-- HubSpot IDs which are 11+ digits — Postgres lpad TRUNCATES strings
-- longer than the length argument, so `lpad('11186316739', 6, '0')`
-- returns `'111863'`. Thousands of unrelated company IDs collapse to
-- the same 6-char prefix, causing `marts.dim_customer` refresh to fail
-- with "duplicate key value violates unique constraint" on idx_dim_customer_id.
--
-- Fix: don't lpad. Use the full hs_object_id verbatim. IDs become
-- variable-length (`co_uk_11186316739`) but stay unique. The pretty
-- zero-padded look can come back as a Phase 1.5 polish if we keep a
-- per-region monotonic counter in a separate table — for now,
-- correctness > prettiness.

CREATE OR REPLACE VIEW staging.customer AS
WITH base AS (
  SELECT
    c.hs_object_id,
    c.payload,
    -- PHASE 0 §A3: confirm the region property on HubSpot Company.
    -- Master plan currently expects derivation from `country`. If GTSE
    -- has a custom `region` property (UK/US), prefer it.
    CASE
      WHEN c.payload->>'country' IN ('United States', 'USA', 'US') THEN 'US'
      ELSE 'UK'
    END AS region_code
  FROM (
    SELECT DISTINCT ON (hs_object_id) *
    FROM raw_hubspot.companies
    ORDER BY hs_object_id, hs_lastmodified DESC
  ) c
)
SELECT
  ('co_' || lower(b.region_code) || '_' || b.hs_object_id::text) AS id,
  b.hs_object_id                                       AS hs_company_id,
  NULLIF(b.payload->>'netsuite_customer_id', '')::bigint AS ns_customer_id,
  b.payload->>'name'                                   AS name,
  b.region_code                                        AS region,
  NULLIF(b.payload->>'industry', '')                   AS industry,
  NULLIF(b.payload->>'state', '')                      AS region_subdiv,
  b.payload->>'hubspot_owner_id'                       AS owner_id,
  (b.payload->>'createdate')::timestamptz              AS created_at,
  (b.payload->>'hs_lastmodifieddate')::timestamptz     AS updated_at
FROM base b;
