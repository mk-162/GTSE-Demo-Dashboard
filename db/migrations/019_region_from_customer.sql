-- Fix duplicate-key crash in marts.dim_customer refresh.
--
-- Migration 018 derived staging.fact_order_lines.region from the order's
-- currency (GBP→UK, USD→US, EUR→UK). That broke an unstated assumption
-- in dim_customer: order_agg GROUPs BY (customer_id, region), so a
-- customer with orders in multiple currencies produced multiple rows
-- in order_agg. dim_customer's LEFT JOIN to order_agg on customer_id
-- alone then duplicated rows → UNIQUE INDEX violation.
--
-- Fix: region on fact_order_lines comes from staging.customer.region
-- (the customer's home region, derived from company country). That
-- keeps the model "one region per customer", which is what the
-- dashboard's UK/US filter actually uses.
--
-- Currency is preserved on the order via raw_hubspot.orders.payload —
-- nothing's lost, just not used for regional bucketing in marts.

CREATE OR REPLACE VIEW staging.fact_order_lines AS
SELECT
  o.hs_object_id                                      AS deal_id,
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
  c.region                                            AS region
FROM (
  SELECT DISTINCT ON (hs_object_id) *
  FROM raw_hubspot.orders
  ORDER BY hs_object_id, hs_lastmodified DESC
) o
JOIN raw_hubspot.assoc_order_company aoc ON aoc.order_id = o.hs_object_id
JOIN staging.customer c ON c.hs_company_id = aoc.company_id
WHERE
  (o.payload->>'hs_total_price')::numeric > 0
  AND COALESCE(
        o.payload->>'hs_external_created_date',
        o.payload->>'hs_closed_date',
        o.payload->>'hs_createdate'
      ) IS NOT NULL
  -- Exclude Cancelled (pipeline stage UUID per orders schema).
  AND o.payload->>'hs_pipeline_stage' != '3c85a297-e9ce-400b-b42e-9f16853d69d6';
