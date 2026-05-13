-- Option B: Deal-amount fallback (the "populated picture" path).
--
-- Most GTSE HubSpot won deals don't have line-item detail (only ~7 line
-- items survive the deal × line_item × company × staging.customer
-- joins). Real line-item-level data lives in NetSuite which is Phase 2.
-- After the initial cutover, marts.dim_customer showed only ONE customer
-- (Babsco US, $19 revenue) which made every dashboard page look empty.
--
-- Fix: union the existing line-item-derived rows with SYNTHETIC rows
-- generated from won-deal amounts where line-item associations are
-- missing. Each such deal becomes one synthetic "order line" with:
--   sku_code  = NULL (we don't know the SKU)
--   quantity  = 1
--   unit_price = deal.amount
--   line_amount = deal.amount
--
-- The fallback hits the ~62 won deals that don't have line-item links
-- — populating revenue / order counts / RFM segments for those
-- customers. The dashboard becomes meaningfully populated. Numbers are
-- coarser (deal level, not SKU level) but directionally correct, and
-- will become authoritative when NetSuite is reintroduced in Phase 2.
--
-- The closed-won stage allowlist is the same as migration 010.

CREATE OR REPLACE VIEW staging.fact_order_lines AS
WITH line_item_rows AS (
  -- Real line items where deal × line_item × company associations exist.
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
          '569083324', '569137614', '751225828', '751225789', '751226601'
        )
    AND d.payload->>'closedate' IS NOT NULL
),
deal_amount_rows AS (
  -- Synthetic "one line item per deal" for won deals that DON'T have a
  -- line-item association. Uses deal.amount as the revenue figure.
  SELECT
    d.hs_object_id                          AS deal_id,
    NULL::text                              AS sku_code,
    1::numeric                              AS quantity,
    (d.payload->>'amount')::numeric         AS unit_price,
    (d.payload->>'amount')::numeric         AS line_amount,
    (d.payload->>'closedate')::date         AS order_date,
    c.id                                    AS customer_id,
    c.region                                AS region
  FROM (
    SELECT DISTINCT ON (hs_object_id) * FROM raw_hubspot.deals
    ORDER BY hs_object_id, hs_lastmodified DESC
  ) d
  JOIN raw_hubspot.assoc_deal_company dc ON dc.deal_id = d.hs_object_id
  JOIN staging.customer c ON c.hs_company_id = dc.company_id
  WHERE d.payload->>'dealstage' IN (
          '569083324', '569137614', '751225828', '751225789', '751226601'
        )
    AND d.payload->>'closedate' IS NOT NULL
    AND d.payload->>'amount' IS NOT NULL
    AND (d.payload->>'amount')::numeric > 0
    AND NOT EXISTS (
      SELECT 1 FROM raw_hubspot.assoc_deal_line_item adl
      WHERE adl.deal_id = d.hs_object_id
    )
)
SELECT * FROM line_item_rows
UNION ALL
SELECT * FROM deal_amount_rows;
