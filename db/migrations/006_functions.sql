-- Customer-intel SQL functions. Ports the math from
-- lib/mock-data/companies.ts and lib/mock-data/segments.ts so dim_customer
-- in the next migration can reference them. STABLE / IMMUTABLE markers
-- let Postgres cache and parallelise the calls.

-- ─── fn_personal_cadence ───────────────────────────────────────────
-- Median day-gap between consecutive orders for one customer.
-- Returns NULL for customers with <2 orders (no gaps to median).
CREATE OR REPLACE FUNCTION marts.fn_personal_cadence(p_customer_id text)
RETURNS int AS $$
  WITH order_dates AS (
    SELECT order_date::date AS d
    FROM staging.fact_order_lines
    WHERE customer_id = p_customer_id
    GROUP BY order_date::date
    ORDER BY order_date::date
  ),
  intervals AS (
    SELECT EXTRACT(EPOCH FROM (d - lag(d) OVER (ORDER BY d))) / 86400 AS days
    FROM order_dates
  )
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::int
  FROM intervals
  WHERE days IS NOT NULL;
$$ LANGUAGE sql STABLE;

-- ─── fn_lapse_ratio ────────────────────────────────────────────────
-- (days since last order) ÷ (personal cadence). >1.0 means slipping,
-- >2.0 means lapsed. NULL when cadence is NULL (single-order customers).
CREATE OR REPLACE FUNCTION marts.fn_lapse_ratio(p_customer_id text)
RETURNS numeric AS $$
  WITH d AS (
    SELECT
      CURRENT_DATE - max(order_date::date) AS days_since,
      marts.fn_personal_cadence(p_customer_id) AS cadence
    FROM staging.fact_order_lines
    WHERE customer_id = p_customer_id
  )
  SELECT (days_since::numeric / NULLIF(cadence, 0)) FROM d;
$$ LANGUAGE sql STABLE;

-- ─── fn_health_score ───────────────────────────────────────────────
-- Composite 0-100 score. Same formula as lib/mock-data/companies.ts:
--   100 - clamp(lapse_ratio, 0, 2.0) * 25
--       - clamp(days_since_engagement / 30, 0, 2.0) * 15
--       + clamp(email_opens, 0, 5) * 4
-- IMMUTABLE since it's a pure function of its arguments.
CREATE OR REPLACE FUNCTION marts.fn_health_score(
  p_lapse_ratio numeric,
  p_days_since_engagement int,
  p_email_opens int
)
RETURNS int AS $$
  SELECT GREATEST(0, LEAST(100,
    100
    - (LEAST(coalesce(p_lapse_ratio, 0), 2.0) * 25)::int
    - (LEAST(coalesce(p_days_since_engagement, 0)::numeric / 30, 2.0) * 15)::int
    + (LEAST(coalesce(p_email_opens, 0), 5) * 4)
  ))::int;
$$ LANGUAGE sql IMMUTABLE;

-- ─── fn_health_band ────────────────────────────────────────────────
-- Maps a health score to its band per the dashboard's thresholds.
CREATE OR REPLACE FUNCTION marts.fn_health_band(p_score int)
RETURNS text AS $$
  SELECT CASE
    WHEN p_score >= 70 THEN 'green'
    WHEN p_score >= 40 THEN 'amber'
    ELSE 'red'
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── fn_rfm_score_recency ──────────────────────────────────────────
-- 5 = ordered in last 30d, 4 = 31-60d, 3 = 61-120d, 2 = 121-240d, 1 = older.
CREATE OR REPLACE FUNCTION marts.fn_rfm_score_recency(p_days_since_last int)
RETURNS int AS $$
  SELECT CASE
    WHEN p_days_since_last <= 30  THEN 5
    WHEN p_days_since_last <= 60  THEN 4
    WHEN p_days_since_last <= 120 THEN 3
    WHEN p_days_since_last <= 240 THEN 2
    ELSE 1
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── fn_rfm_score_frequency ────────────────────────────────────────
CREATE OR REPLACE FUNCTION marts.fn_rfm_score_frequency(p_lifetime_orders int)
RETURNS int AS $$
  SELECT CASE
    WHEN p_lifetime_orders >= 50 THEN 5
    WHEN p_lifetime_orders >= 24 THEN 4
    WHEN p_lifetime_orders >= 12 THEN 3
    WHEN p_lifetime_orders >= 4  THEN 2
    ELSE 1
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── fn_rfm_score_monetary ─────────────────────────────────────────
-- Thresholds in customer's local currency (£ for UK, $ for US). The
-- dashboard's mock data uses these same thresholds region-agnostic.
CREATE OR REPLACE FUNCTION marts.fn_rfm_score_monetary(p_ltm_revenue numeric)
RETURNS int AS $$
  SELECT CASE
    WHEN p_ltm_revenue >= 50000 THEN 5
    WHEN p_ltm_revenue >= 20000 THEN 4
    WHEN p_ltm_revenue >= 8000  THEN 3
    WHEN p_ltm_revenue >= 2500  THEN 2
    ELSE 1
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── fn_rfm_segment ────────────────────────────────────────────────
-- Maps (R, F, M) scores to a named segment per
-- lib/mock-data/companies.ts:rfmSegmentFromScores.
CREATE OR REPLACE FUNCTION marts.fn_rfm_segment(p_r int, p_f int, p_m int)
RETURNS text AS $$
  SELECT CASE
    WHEN p_r >= 4 AND p_f >= 4 AND p_m >= 4 THEN 'Champion'
    WHEN p_r >= 4 AND p_f >= 3              THEN 'Loyal'
    WHEN p_r >= 4 AND p_f <= 2              THEN 'Promising'
    WHEN p_r <= 2 AND p_f >= 4 AND p_m >= 4 THEN 'CannotLose'
    WHEN p_r <= 2 AND p_f >= 3              THEN 'AtRisk'
    WHEN p_r <= 2 AND p_f <= 2              THEN 'Hibernating'
    WHEN p_r >= 4 AND p_f <= 1              THEN 'New'
    ELSE 'Loyal'
  END;
$$ LANGUAGE sql IMMUTABLE;
