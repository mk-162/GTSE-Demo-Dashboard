-- BREAKTHROUGH MIGRATION (2026-05-13).
--
-- staging.fact_order_lines now sources from HubSpot's Orders object
-- (74k real transactions) instead of Deals (323 sales-rep pipeline
-- records). The dashboard's revenue / cadence / lapse / reorder
-- analytics finally have data to operate on.
--
-- Key changes vs the previous (Deals-based) definition:
--   1. Source: raw_hubspot.orders × raw_hubspot.assoc_order_company,
--      not the deal × line_item × company joins.
--   2. Region: derived from order currency (GBP→UK, USD→US, EUR→UK
--      per the Phase 1 simplification — see HubSpot AI conversation
--      2026-05-13 confirming "use currency to split for now").
--   3. order_date: hs_external_created_date (when the order was placed
--      in the source system) rather than HubSpot's import date.
--   4. line_amount: hs_total_price — penny-precise, not the round-
--      numbered rep estimates from deal.amount.
--   5. Filter: excludes Cancelled orders (pipeline_stage UUID
--      3c85a297-e9ce-400b-b42e-9f16853d69d6). Includes Open / Processed
--      / Shipped / Delivered.
--
-- Phase 1 simplification: we use ORDER-LEVEL totals (one synthetic
-- line per order with sku_code = NULL). Per-SKU detail would require
-- pulling Order→Line_Item associations AND line item data, which we
-- defer until cross-sell analysis becomes important. Order-level data
-- is sufficient for revenue / cadence / lapse / RFM / health.
--
-- The Deals-based path is gone: 323 deals → 64 synthetic rows became
-- 74k orders → tens of thousands of real revenue rows.

CREATE OR REPLACE VIEW staging.fact_order_lines AS
SELECT
  o.hs_object_id                                      AS deal_id,
  -- "deal_id" name is legacy from the old definition. Renaming would
  -- ripple through dim_customer + 6 dependent marts; keep the name,
  -- store the order's hs_object_id instead. Phase 2 cleanup.
  NULL::text                                          AS sku_code,
  1::numeric                                          AS quantity,
  (o.payload->>'hs_total_price')::numeric             AS unit_price,
  (o.payload->>'hs_total_price')::numeric             AS line_amount,
  COALESCE(
    (o.payload->>'hs_external_created_date')::date,
    (o.payload->>'hs_closed_date')::date,
    (o.payload->>'hs_createdate')::date
  )                                                   AS order_date,
  c.id                                                AS customer_id,
  -- Region from order currency, per Phase 1 simplification.
  CASE
    WHEN o.payload->>'hs_currency_code' = 'USD' THEN 'US'
    ELSE 'UK'   -- GBP + EUR both fold into UK
  END                                                 AS region
FROM (
  SELECT DISTINCT ON (hs_object_id) *
  FROM raw_hubspot.orders
  ORDER BY hs_object_id, hs_lastmodified DESC
) o
JOIN raw_hubspot.assoc_order_company aoc ON aoc.order_id = o.hs_object_id
JOIN staging.customer c ON c.hs_company_id = aoc.company_id
WHERE
  -- Must have a total to count as revenue.
  (o.payload->>'hs_total_price')::numeric > 0
  -- Must have a real date.
  AND COALESCE(
        o.payload->>'hs_external_created_date',
        o.payload->>'hs_closed_date',
        o.payload->>'hs_createdate'
      ) IS NOT NULL
  -- Exclude Cancelled orders. UUID confirmed via probe-orders.ts —
  -- the schema includes columns named hs_date_entered_3c85a297..._cancelled.
  AND o.payload->>'hs_pipeline_stage' != '3c85a297-e9ce-400b-b42e-9f16853d69d6';
