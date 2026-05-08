-- Staging views — the join layer between raw_hubspot + raw_netsuite and
-- the dashboard-facing marts. Plain VIEWs (not materialised) so they
-- always reflect the latest raw row per object; the marts in 007 are
-- materialised because the dashboard reads them on every page load and
-- we don't want to recompute the joins per-request.

-- ─── staging.customer ──────────────────────────────────────────────
-- One row per HubSpot Company, with the NetSuite customer ID resolved
-- (via the property confirmed in Phase 0 §A6) and the canonical region
-- derived from billing country.
--
-- The customer_id is namespaced by region so a US customer's id is
-- 'co_us_000123', not 'co_united_states_000123' — derived from region
-- inside a CTE so the CASE expression stays in sync between the region
-- column and the id.
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
  ('co_' || lower(b.region_code) || '_' || lpad(b.hs_object_id::text, 6, '0')) AS id,
  b.hs_object_id                                       AS hs_company_id,
  -- PHASE 0 §A6: confirm property name. Falls through to NULL if unset
  -- on this Company; staging.fact_order_lines + dim_customer drop those
  -- rows, so a missing key doesn't pollute joins.
  NULLIF(b.payload->>'netsuite_customer_id', '')::bigint AS ns_customer_id,
  b.payload->>'name'                                   AS name,
  b.region_code                                        AS region,
  -- PHASE 0 §A4: confirm `industry` is populated and on what taxonomy
  -- (HubSpot standard / GTSE custom / SIC). Empty string treated as NULL.
  NULLIF(b.payload->>'industry', '')                   AS industry,
  -- HubSpot's billing state field — used for region_subdiv (UK county /
  -- US state). May be empty; surface as NULL.
  NULLIF(b.payload->>'state', '')                      AS region_subdiv,
  b.payload->>'hubspot_owner_id'                       AS owner_id,
  (b.payload->>'createdate')::timestamptz              AS created_at,
  (b.payload->>'hs_lastmodifieddate')::timestamptz     AS updated_at
FROM base b;

-- ─── staging.sku ───────────────────────────────────────────────────
-- One row per NetSuite item. Joined to HubSpot line items in
-- fact_order_lines via the SKU code (Phase 0 §A2 confirms the matching
-- property name).
CREATE OR REPLACE VIEW staging.sku AS
SELECT
  ni.payload->>'itemid'              AS sku_code,
  ni.internal_id                     AS ns_item_id,
  ni.payload->>'displayname'         AS name,
  -- PHASE 0 §B6/B7: confirm the SuiteQL field names for category +
  -- standard cost. These are common NetSuite columns but vary by
  -- account configuration.
  NULLIF(ni.payload->>'class', '')   AS category,
  NULLIF(ni.payload->>'cost', '')::numeric    AS unit_cost,
  NULLIF(ni.payload->>'baseprice', '')::numeric AS list_price,
  (ni.payload->>'isinactive')::boolean AS is_inactive
FROM (
  SELECT DISTINCT ON (internal_id) *
  FROM raw_netsuite.items
  ORDER BY internal_id, last_modified DESC
) ni;

-- ─── staging.fact_order_lines ──────────────────────────────────────
-- One row per line item on a closed-won deal. Joins HubSpot deals →
-- line items via the explicit assoc_deal_line_item table, and resolves
-- the customer via assoc_deal_company → staging.customer.
--
-- Phase 0 §A1 confirms the deal stage value that means "closed-won /
-- shipped". Master plan defaults to 'closedwon'; some HubSpot accounts
-- use a custom pipeline with non-standard stage IDs (e.g. '11824519').
CREATE OR REPLACE VIEW staging.fact_order_lines AS
SELECT
  d.hs_object_id                          AS deal_id,
  -- PHASE 0 §A2: confirm `hs_sku` property. If GTSE uses a different
  -- property name, update both this column reference and pull-line-items.ts.
  li.payload->>'hs_sku'                   AS sku_code,
  (li.payload->>'quantity')::numeric      AS quantity,
  (li.payload->>'price')::numeric         AS unit_price,
  (li.payload->>'amount')::numeric        AS line_amount,
  (d.payload->>'closedate')::date         AS order_date,
  c.id                                    AS customer_id,
  c.region                                AS region
FROM (
  SELECT DISTINCT ON (hs_object_id) * FROM raw_hubspot.deals
  ORDER BY hs_object_id, hs_lastmodified DESC
) d
JOIN raw_hubspot.assoc_deal_line_item dli ON dli.deal_id = d.hs_object_id
JOIN (
  SELECT DISTINCT ON (hs_object_id) * FROM raw_hubspot.line_items
  ORDER BY hs_object_id, hs_lastmodified DESC
) li ON li.hs_object_id = dli.line_item_id
JOIN raw_hubspot.assoc_deal_company dc ON dc.deal_id = d.hs_object_id
JOIN staging.customer c ON c.hs_company_id = dc.company_id
-- PHASE 0 §A1: confirm the exact stage value. Default per master plan.
WHERE d.payload->>'dealstage' = 'closedwon'
  AND d.payload->>'closedate' IS NOT NULL;
