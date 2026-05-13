-- Replace staging.fact_order_lines' WHERE clause: the default
-- master-plan filter `dealstage = 'closedwon'` returns ZERO rows
-- against GTSE's HubSpot. They use 5 custom pipelines with numeric
-- stage IDs, not the default 'closedwon' string.
--
-- The 5 "Closed Won" stage IDs were enumerated via the HubSpot Pipelines
-- API on 2026-05-13 by scripts/check-pipelines.ts. They are:
--
--   569083324  Direct UK         "Closed won"
--   569137614  Inbound Ecom      "Closed won"
--   751225828  Direct US         "6. Initial order received"
--   751225789  Agent US          "6. Initial order received"
--   751226601  Buying Group US   "6. Initial order received"
--
-- To regenerate this list (e.g. when GTSE adds a new pipeline), run:
--   pnpm tsx --env-file=.env.local scripts/check-pipelines.ts
-- Look for "✓ WON" markers (stages with metadata.probability = 1.0 and
-- isClosed = true).
--
-- A more flexible long-term design would store these in a config table
-- populated from the API, but for Phase 1 a hardcoded allowlist is
-- simpler and easier to audit.

CREATE OR REPLACE VIEW staging.fact_order_lines AS
SELECT
  d.hs_object_id                          AS deal_id,
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
WHERE d.payload->>'dealstage' IN (
        '569083324',  -- Direct UK / Closed won
        '569137614',  -- Inbound Ecom / Closed won
        '751225828',  -- Direct US / Initial order received
        '751225789',  -- Agent US / Initial order received
        '751226601'   -- Buying Group US / Initial order received
      )
  AND d.payload->>'closedate' IS NOT NULL;
