-- Performance fix: marts.dim_customer refresh was taking 30+ minutes
-- (and hadn't completed at all in some runs). The bottleneck is
-- per-row function calls inside dim_customer's main SELECT:
--
--   marts.fn_personal_cadence(c.id)  -- called 3 times per row
--   marts.fn_lapse_ratio(c.id)        -- called 2 times per row
--
-- Each function call scans staging.fact_order_lines — which is a regular
-- VIEW with a 4-way join (raw_hubspot.deals × line_items × assoc_deal_*
-- × staging.customer). 40k rows × 5 function calls = 200k full
-- evaluations of those joins. That's the slowness.
--
-- Fix: introduce a materialized version of fact_order_lines that the
-- functions can use. One table scan to populate (during refresh), then
-- 200k fast indexed lookups via the customer_id index. The staging
-- VIEW stays as-is so dim_customer's order_agg CTE (which scans it
-- once, not per-row) continues to work unchanged.
--
-- This MV is added to MART_VIEWS in lib/transform/run-transform.ts so
-- it refreshes BEFORE dim_customer on each transform run.

CREATE MATERIALIZED VIEW IF NOT EXISTS marts.fact_order_lines AS
SELECT * FROM staging.fact_order_lines;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fol_mat_deal_sku
  ON marts.fact_order_lines (deal_id, sku_code);
CREATE INDEX IF NOT EXISTS idx_fol_mat_customer
  ON marts.fact_order_lines (customer_id);
CREATE INDEX IF NOT EXISTS idx_fol_mat_order_date
  ON marts.fact_order_lines (order_date);

-- Repoint the functions at the materialized version. The function
-- bodies are otherwise identical to 006_functions.sql — only the
-- FROM clause changes.
CREATE OR REPLACE FUNCTION marts.fn_personal_cadence(p_customer_id text)
RETURNS int AS $$
  WITH order_dates AS (
    SELECT order_date::date AS d
    FROM marts.fact_order_lines
    WHERE customer_id = p_customer_id
    GROUP BY order_date::date
    ORDER BY order_date::date
  ),
  intervals AS (
    SELECT (d - lag(d) OVER (ORDER BY d))::numeric AS days
    FROM order_dates
  )
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::int
  FROM intervals
  WHERE days IS NOT NULL;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION marts.fn_lapse_ratio(p_customer_id text)
RETURNS numeric AS $$
  WITH d AS (
    SELECT
      CURRENT_DATE - max(order_date::date) AS days_since,
      marts.fn_personal_cadence(p_customer_id) AS cadence
    FROM marts.fact_order_lines
    WHERE customer_id = p_customer_id
  )
  SELECT (days_since::numeric / NULLIF(cadence, 0)) FROM d;
$$ LANGUAGE sql STABLE;
