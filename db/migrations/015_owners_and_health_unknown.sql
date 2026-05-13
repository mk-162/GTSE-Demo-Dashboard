-- Phase 1A: populate owner_name + introduce 'unknown' health band.
--
-- Two display fixes against the live HubSpot data:
--
-- 1. dim_customer.owner_name was hardcoded to owner_id (the numeric
--    HubSpot owner ID) because we hadn't pulled the owners API. The
--    dashboard's account pages and target lists showed "1857024499"
--    where they should show "Sam Smith". This migration introduces:
--      - raw_hubspot.owners (the new ingest target)
--      - staging.owner (clean projection)
--      - staging.customer.owner_name (joined from staging.owner)
--      - dim_customer rebuilt to pull owner_name through
--
-- 2. fn_health_score returned 100 (max health) when all engagement +
--    lapse inputs were NULL, so every customer with no order history
--    appeared "Green" — misleading. New behaviour: return NULL when
--    there's nothing to score, and fn_health_band returns 'unknown'.
--    Frontend has been updated to render 'unknown' as a neutral band.

-- ─── 1. Owners table + staging view ───────────────────────────────

CREATE TABLE IF NOT EXISTS raw_hubspot.owners (
  hs_object_id  bigint      PRIMARY KEY,
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  payload       jsonb       NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_hubspot_owners_id
  ON raw_hubspot.owners (hs_object_id);

CREATE OR REPLACE VIEW staging.owner AS
SELECT
  hs_object_id::text          AS owner_id,
  payload->>'email'           AS email,
  NULLIF(TRIM(
    COALESCE(payload->>'firstName', '') || ' ' ||
    COALESCE(payload->>'lastName', '')
  ), '')                      AS full_name
FROM raw_hubspot.owners;

-- ─── 2. staging.customer with owner_name joined in ────────────────

-- CREATE OR REPLACE VIEW preserves column ORDER (not just names);
-- adding a new column in the middle errors with "cannot change name of
-- view column". owner_name must therefore be the LAST column. The
-- consumers (dim_customer + the data layer) reference columns by name,
-- not position, so this is purely a constraint of the OR REPLACE
-- semantics.
CREATE OR REPLACE VIEW staging.customer AS
WITH base AS (
  SELECT
    c.hs_object_id,
    c.payload,
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
  (b.payload->>'hs_lastmodifieddate')::timestamptz     AS updated_at,
  -- Owner name: prefer the human name from staging.owner; fall back to
  -- the raw owner_id (showing a number is worse than showing the column
  -- empty, but less worse than 500ing). At the END of the SELECT list
  -- because CREATE OR REPLACE VIEW preserves column order.
  COALESCE(o.full_name, b.payload->>'hubspot_owner_id') AS owner_name
FROM base b
LEFT JOIN staging.owner o ON o.owner_id = b.payload->>'hubspot_owner_id';

-- ─── 3. fn_health_score returns NULL when there's no signal ───────
-- 'unknown' band is added in fn_health_band. The dashboard treats NULL
-- score / 'unknown' band as a separate neutral category.
CREATE OR REPLACE FUNCTION marts.fn_health_score(
  p_lapse_ratio numeric,
  p_days_since_engagement int,
  p_email_opens int
)
RETURNS int AS $$
  SELECT CASE
    WHEN p_lapse_ratio IS NULL
     AND p_days_since_engagement IS NULL
     AND p_email_opens IS NULL
    THEN NULL
    ELSE GREATEST(0, LEAST(100,
      100
      - (LEAST(coalesce(p_lapse_ratio, 0), 2.0) * 25)::int
      - (LEAST(coalesce(p_days_since_engagement, 0)::numeric / 30, 2.0) * 15)::int
      + (LEAST(coalesce(p_email_opens, 0), 5) * 4)
    ))::int
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION marts.fn_health_band(p_score int)
RETURNS text AS $$
  SELECT CASE
    WHEN p_score IS NULL THEN 'unknown'
    WHEN p_score >= 70   THEN 'green'
    WHEN p_score >= 40   THEN 'amber'
    ELSE 'red'
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── 4. Recreate dim_customer + dependent marts ───────────────────
-- We have to DROP + CREATE because materialized view definitions are
-- not alterable. CASCADE drops all 6 dependent marts; we recreate them
-- below with their original (unchanged) SQL from migration 007.

DROP MATERIALIZED VIEW IF EXISTS marts.company_health CASCADE;
DROP MATERIALIZED VIEW IF EXISTS marts.rfm_segments CASCADE;
DROP MATERIALIZED VIEW IF EXISTS marts.kpi_overview CASCADE;
DROP MATERIALIZED VIEW IF EXISTS marts.reorder_due CASCADE;
DROP MATERIALIZED VIEW IF EXISTS marts.lapsed CASCADE;
DROP MATERIALIZED VIEW IF EXISTS marts.whales CASCADE;
DROP MATERIALIZED VIEW IF EXISTS marts.dim_customer CASCADE;

CREATE MATERIALIZED VIEW marts.dim_customer AS
WITH order_agg AS (
  SELECT
    customer_id,
    region,
    count(DISTINCT order_date)               AS lifetime_orders,
    sum(line_amount)                         AS lifetime_revenue,
    min(order_date)                          AS first_order_date,
    max(order_date)                          AS last_order_date,
    sum(line_amount) FILTER (WHERE order_date > CURRENT_DATE - 365) AS ltm_revenue,
    sum(line_amount) FILTER (WHERE order_date > CURRENT_DATE - 90)  AS l90d_revenue,
    sum(line_amount) FILTER (
      WHERE order_date > CURRENT_DATE - 180
        AND order_date <= CURRENT_DATE - 90
    ) AS prior_90d_revenue
  FROM staging.fact_order_lines
  GROUP BY customer_id, region
),
ranked AS (
  SELECT
    customer_id,
    row_number() OVER (PARTITION BY region ORDER BY ltm_revenue DESC NULLS LAST) AS rev_rank,
    sum(coalesce(l90d_revenue, 0)) OVER (PARTITION BY region) AS region_l90d_total
  FROM order_agg
)
SELECT
  c.id                                                      AS id,
  c.hs_company_id                                           AS hs_company_id,
  c.ns_customer_id                                          AS ns_customer_id,
  c.name                                                    AS name,
  c.region                                                  AS region,
  c.industry                                                AS industry,
  c.region_subdiv                                           AS region_subdiv,
  c.owner_id                                                AS owner_id,
  c.owner_name                                              AS owner_name,
  CASE
    WHEN r.rev_rank <= 50   THEN 'large'
    WHEN r.rev_rank <= 250  THEN 'mid'
    WHEN r.rev_rank <= 1500 THEN 'small'
    ELSE 'micro'
  END                                                       AS size_band,
  oa.first_order_date                                       AS first_order_date,
  oa.last_order_date                                        AS last_order_date,
  coalesce(oa.lifetime_orders, 0)                           AS lifetime_orders,
  coalesce(oa.lifetime_revenue, 0)                          AS lifetime_revenue,
  coalesce(oa.ltm_revenue, 0)                               AS ltm_revenue,
  coalesce(oa.l90d_revenue, 0)                              AS l90d_revenue,
  coalesce(oa.prior_90d_revenue, 0)                         AS prior_90d_revenue,
  marts.fn_personal_cadence(c.id)                           AS personal_cadence_days,
  CASE
    WHEN oa.last_order_date IS NULL THEN NULL
    ELSE (CURRENT_DATE - oa.last_order_date)::int
  END                                                       AS days_since_last_order,
  CASE
    WHEN oa.last_order_date IS NULL OR marts.fn_personal_cadence(c.id) IS NULL THEN NULL
    ELSE (oa.last_order_date + (marts.fn_personal_cadence(c.id) || ' days')::interval)::date
  END                                                       AS predicted_next_order_date,
  marts.fn_lapse_ratio(c.id)                                AS lapse_ratio,
  NULL::date                                                AS last_engagement_date,
  NULL::int                                                 AS days_since_last_engagement,
  NULL::int                                                 AS email_opens_l60d,
  NULL::int                                                 AS active_contacts,
  false                                                     AS buyer_intent_active,
  marts.fn_health_score(
    marts.fn_lapse_ratio(c.id),
    NULL,
    NULL
  )                                                         AS health_score,
  marts.fn_health_band(
    marts.fn_health_score(marts.fn_lapse_ratio(c.id), NULL, NULL)
  )                                                         AS health_band,
  marts.fn_rfm_score_recency(
    coalesce((CURRENT_DATE - oa.last_order_date)::int, 999)
  )                                                         AS rfm_score_r,
  marts.fn_rfm_score_frequency(coalesce(oa.lifetime_orders, 0)) AS rfm_score_f,
  marts.fn_rfm_score_monetary(coalesce(oa.ltm_revenue, 0))      AS rfm_score_m,
  marts.fn_rfm_segment(
    marts.fn_rfm_score_recency(coalesce((CURRENT_DATE - oa.last_order_date)::int, 999)),
    marts.fn_rfm_score_frequency(coalesce(oa.lifetime_orders, 0)),
    marts.fn_rfm_score_monetary(coalesce(oa.ltm_revenue, 0))
  )                                                         AS rfm_segment,
  (r.rev_rank <= 50)                                        AS whale_flag,
  CASE
    WHEN r.region_l90d_total > 0
      THEN round((coalesce(oa.l90d_revenue, 0) / r.region_l90d_total * 1000)::numeric, 1) / 10
    ELSE 0
  END                                                       AS concentration_pct_l90d,
  ARRAY[]::text[]                                           AS top_3_reorder_skus,
  ARRAY[]::text[]                                           AS top_3_cross_sell_skus
FROM staging.customer c
LEFT JOIN order_agg oa ON oa.customer_id = c.id
LEFT JOIN ranked   r  ON r.customer_id  = c.id;

CREATE UNIQUE INDEX idx_dim_customer_id
  ON marts.dim_customer (id);
CREATE INDEX idx_dim_customer_region_ltm
  ON marts.dim_customer (region, ltm_revenue DESC NULLS LAST);
CREATE INDEX idx_dim_customer_region_health
  ON marts.dim_customer (region, health_band);
CREATE INDEX idx_dim_customer_region_lapse
  ON marts.dim_customer (region, lapse_ratio NULLS LAST);

-- Recreate dependent marts. SQL is identical to migration 007 — only
-- dim_customer's definition changed, and the dependents just SELECT
-- from it.

CREATE MATERIALIZED VIEW marts.whales AS
SELECT *
FROM (
  SELECT
    *,
    row_number() OVER (PARTITION BY region ORDER BY ltm_revenue DESC NULLS LAST) AS rev_rank
  FROM marts.dim_customer
) ranked
WHERE rev_rank <= 50;
CREATE UNIQUE INDEX idx_whales_id ON marts.whales (id);

CREATE MATERIALIZED VIEW marts.lapsed AS
SELECT *
FROM marts.dim_customer
WHERE lapse_ratio >= 1.5
ORDER BY lifetime_revenue DESC;
CREATE UNIQUE INDEX idx_lapsed_id ON marts.lapsed (id);

CREATE MATERIALIZED VIEW marts.reorder_due AS
SELECT *
FROM marts.dim_customer
WHERE lifetime_orders >= 3
  AND predicted_next_order_date IS NOT NULL
  AND (predicted_next_order_date - CURRENT_DATE) BETWEEN -45 AND 30;
CREATE UNIQUE INDEX idx_reorder_due_id ON marts.reorder_due (id);

CREATE MATERIALIZED VIEW marts.kpi_overview AS
WITH region_totals AS (
  SELECT region, sum(ltm_revenue) AS region_ltm_total, count(*) AS region_count
  FROM marts.dim_customer GROUP BY region
),
ranked AS (
  SELECT region, ltm_revenue,
    row_number() OVER (PARTITION BY region ORDER BY ltm_revenue DESC NULLS LAST) AS rank
  FROM marts.dim_customer
),
top_n AS (
  SELECT region,
    sum(ltm_revenue) FILTER (WHERE rank <= 10) AS top_10_ltm,
    sum(ltm_revenue) FILTER (WHERE rank <= 20) AS top_20_ltm,
    sum(ltm_revenue) FILTER (WHERE rank <= 50) AS top_50_ltm
  FROM ranked GROUP BY region
),
ltv_pct AS (
  SELECT region,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY lifetime_revenue) AS p25,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY lifetime_revenue) AS p50,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY lifetime_revenue) AS p75,
    percentile_cont(0.90) WITHIN GROUP (ORDER BY lifetime_revenue) AS p90,
    avg(lifetime_revenue) AS mean
  FROM marts.dim_customer GROUP BY region
),
dc_agg AS (
  SELECT region,
    count(*) FILTER (WHERE days_since_last_order <= 365)  AS active_customers_ltm,
    count(*) FILTER (WHERE lapse_ratio >= 2.0)            AS cadence_churn_count,
    count(*) FILTER (WHERE days_since_last_order > 365)   AS rolling_churn_count,
    count(*) FILTER (WHERE lifetime_orders >= 2)          AS repeat_count,
    sum(coalesce(lifetime_orders, 0))                     AS total_lifetime_orders
  FROM marts.dim_customer GROUP BY region
)
SELECT
  rt.region                                                              AS region,
  CURRENT_DATE                                                            AS as_of_date,
  rt.region_count::int                                                    AS total_customers,
  da.active_customers_ltm::int                                            AS active_customers_ltm,
  round(p.p25)::int                                                       AS ltv_p25,
  round(p.p50)::int                                                       AS ltv_p50,
  round(p.p75)::int                                                       AS ltv_p75,
  round(p.p90)::int                                                       AS ltv_p90,
  round(p.mean)::int                                                      AS ltv_mean,
  round(rt.region_ltm_total / NULLIF(da.total_lifetime_orders, 0))::int   AS aov,
  round(100.0 * da.cadence_churn_count / NULLIF(rt.region_count, 0), 1)   AS churn_rate_cadence,
  round(100.0 * da.rolling_churn_count / NULLIF(rt.region_count, 0), 1)   AS churn_rate_rolling,
  round(100.0 * da.repeat_count / NULLIF(rt.region_count, 0), 1)          AS repeat_rate,
  round(coalesce(tn.top_10_ltm, 0) / NULLIF(rt.region_ltm_total, 0) * 1000) / 10 AS concentration_top_10,
  round(coalesce(tn.top_20_ltm, 0) / NULLIF(rt.region_ltm_total, 0) * 1000) / 10 AS concentration_top_20,
  round(coalesce(tn.top_50_ltm, 0) / NULLIF(rt.region_ltm_total, 0) * 1000) / 10 AS concentration_top_50
FROM region_totals rt
JOIN ltv_pct  p   ON p.region  = rt.region
LEFT JOIN top_n tn ON tn.region = rt.region
JOIN dc_agg   da   ON da.region = rt.region;
CREATE UNIQUE INDEX idx_kpi_overview_region ON marts.kpi_overview (region);

CREATE MATERIALIZED VIEW marts.rfm_segments AS
SELECT region, rfm_segment, count(*) AS account_count,
  sum(ltm_revenue) AS total_ltm_revenue,
  round(avg(ltm_revenue)) AS avg_ltm_revenue,
  array_agg(id ORDER BY ltm_revenue DESC) AS company_ids
FROM marts.dim_customer
GROUP BY region, rfm_segment;
CREATE UNIQUE INDEX idx_rfm_segments_region_segment
  ON marts.rfm_segments (region, rfm_segment);

CREATE MATERIALIZED VIEW marts.company_health AS
SELECT region, health_band, count(*) AS account_count,
  sum(ltm_revenue) AS total_ltm_revenue,
  array_agg(id ORDER BY lifetime_revenue DESC) AS company_ids
FROM marts.dim_customer
GROUP BY region, health_band;
CREATE UNIQUE INDEX idx_company_health_region_band
  ON marts.company_health (region, health_band);
