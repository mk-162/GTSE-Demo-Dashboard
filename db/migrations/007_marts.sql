-- Materialised views the dashboard reads on every page load. Refreshed
-- nightly by /api/cron/transform. UNIQUE INDEX on each is required for
-- REFRESH MATERIALIZED VIEW CONCURRENTLY (otherwise refresh holds an
-- ACCESS EXCLUSIVE lock and dashboard reads wait).
--
-- Some derived columns marked PHASE 0 — the math is correct but depends
-- on confirming the source property name. Those default to NULL or a
-- placeholder until Phase 0 confirms; the dashboard tolerates NULLs
-- (renders "—" or skips the row).

-- ─── marts.dim_customer ────────────────────────────────────────────
-- The customer spine. One row per customer with every field the
-- dashboard's Company type needs. Built from staging.customer joined
-- to per-customer aggregates over staging.fact_order_lines.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.dim_customer AS
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
  -- PHASE 0: owner_name resolution. HubSpot owner objects expose firstname/
  -- lastname under /crm/v3/owners/{id}; we'd resolve via an owners staging
  -- view once we pull them. Until then expose the id.
  c.owner_id                                                AS owner_name,
  -- Size band by revenue rank (matches lib/mock-data/companies.ts).
  CASE
    WHEN r.rev_rank <= 50   THEN 'large'
    WHEN r.rev_rank <= 250  THEN 'mid'
    WHEN r.rev_rank <= 1500 THEN 'small'
    ELSE 'micro'
  END                                                       AS size_band,
  -- Order metrics.
  oa.first_order_date                                       AS first_order_date,
  oa.last_order_date                                        AS last_order_date,
  coalesce(oa.lifetime_orders, 0)                           AS lifetime_orders,
  coalesce(oa.lifetime_revenue, 0)                          AS lifetime_revenue,
  coalesce(oa.ltm_revenue, 0)                               AS ltm_revenue,
  coalesce(oa.l90d_revenue, 0)                              AS l90d_revenue,
  coalesce(oa.prior_90d_revenue, 0)                         AS prior_90d_revenue,
  -- Cadence + lapse via fn_personal_cadence + fn_lapse_ratio.
  marts.fn_personal_cadence(c.id)                           AS personal_cadence_days,
  CASE
    WHEN oa.last_order_date IS NULL THEN NULL
    ELSE (CURRENT_DATE - oa.last_order_date)::int
  END                                                       AS days_since_last_order,
  -- Predicted next order = last + cadence (per lib/mock-data/companies.ts).
  CASE
    WHEN oa.last_order_date IS NULL OR marts.fn_personal_cadence(c.id) IS NULL THEN NULL
    ELSE (oa.last_order_date + (marts.fn_personal_cadence(c.id) || ' days')::interval)::date
  END                                                       AS predicted_next_order_date,
  marts.fn_lapse_ratio(c.id)                                AS lapse_ratio,
  -- Engagement-derived signals. PHASE 0 §A5 + §A7 + §A8 — for now
  -- these surface as NULLs; staging.engagement view + dim_customer
  -- aggregations get added once Phase 0 confirms property names.
  NULL::date                                                AS last_engagement_date,
  NULL::int                                                 AS days_since_last_engagement,
  NULL::int                                                 AS email_opens_l60d,
  NULL::int                                                 AS active_contacts,
  -- Buyer intent — typically a HubSpot integration property; PHASE 0
  -- should confirm the property name (could be `gtse_buyer_intent_active`,
  -- `intent_signal`, or similar).
  false                                                     AS buyer_intent_active,
  -- Health score: depends on engagement data. With NULL engagement
  -- inputs the score collapses to lapse_ratio penalty only — directional
  -- but not full-fidelity until engagement staging is in.
  marts.fn_health_score(
    marts.fn_lapse_ratio(c.id),
    NULL,
    NULL
  )                                                         AS health_score,
  marts.fn_health_band(
    marts.fn_health_score(marts.fn_lapse_ratio(c.id), NULL, NULL)
  )                                                         AS health_band,
  -- RFM scoring.
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
  -- Whale flag = top 50 by LTM revenue per region.
  (r.rev_rank <= 50)                                        AS whale_flag,
  -- Concentration: this customer's L90d revenue / regional L90d total.
  CASE
    WHEN r.region_l90d_total > 0
      THEN round((coalesce(oa.l90d_revenue, 0) / r.region_l90d_total * 1000)::numeric, 1) / 10
    ELSE 0
  END                                                       AS concentration_pct_l90d,
  -- Top reorder/cross-sell SKU arrays. Computing these properly needs
  -- per-customer SKU aggregation + peer-basket lift, which we run as
  -- separate marts in a follow-up. Empty arrays here keep the type stable.
  ARRAY[]::text[]                                           AS top_3_reorder_skus,
  ARRAY[]::text[]                                           AS top_3_cross_sell_skus
FROM staging.customer c
LEFT JOIN order_agg oa ON oa.customer_id = c.id
LEFT JOIN ranked   r  ON r.customer_id  = c.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dim_customer_id
  ON marts.dim_customer (id);
CREATE INDEX IF NOT EXISTS idx_dim_customer_region_ltm
  ON marts.dim_customer (region, ltm_revenue DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_dim_customer_region_health
  ON marts.dim_customer (region, health_band);
CREATE INDEX IF NOT EXISTS idx_dim_customer_region_lapse
  ON marts.dim_customer (region, lapse_ratio NULLS LAST);

-- ─── marts.whales ──────────────────────────────────────────────────
-- Top 50 per region by LTM revenue.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.whales AS
SELECT *
FROM (
  SELECT
    *,
    row_number() OVER (PARTITION BY region ORDER BY ltm_revenue DESC NULLS LAST) AS rev_rank
  FROM marts.dim_customer
) ranked
WHERE rev_rank <= 50;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whales_id ON marts.whales (id);

-- ─── marts.lapsed ──────────────────────────────────────────────────
-- Lapse ratio >= 1.5 (slipping + lapsed + dormant, per dashboard tier
-- definitions in lib/mock-data/index.ts:lapsedTier).
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.lapsed AS
SELECT *
FROM marts.dim_customer
WHERE lapse_ratio >= 1.5
ORDER BY lifetime_revenue DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lapsed_id ON marts.lapsed (id);

-- ─── marts.reorder_due ─────────────────────────────────────────────
-- Established customers (>=3 lifetime orders) whose predicted next
-- order date falls in [-45d, +30d].
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.reorder_due AS
SELECT *
FROM marts.dim_customer
WHERE lifetime_orders >= 3
  AND predicted_next_order_date IS NOT NULL
  AND (predicted_next_order_date - CURRENT_DATE) BETWEEN -45 AND 30;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reorder_due_id ON marts.reorder_due (id);

-- ─── marts.kpi_overview ────────────────────────────────────────────
-- Per-region aggregate KPIs the /kpis page reads. ONE ROW per region
-- by construction (every CTE GROUPs BY region, and the final SELECT
-- joins them all on region). Earlier versions did
-- `JOIN dim_customer ... LIMIT 2` with window functions, which
-- produced one row per dim_customer record and used LIMIT 2 as a hack;
-- that broke when LIMIT picked two rows from the same region. See
-- migration 013_fix_kpi_overview.sql for the history.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.kpi_overview AS
WITH region_totals AS (
  SELECT
    region,
    sum(ltm_revenue)         AS region_ltm_total,
    count(*)                 AS region_count
  FROM marts.dim_customer
  GROUP BY region
),
ranked AS (
  SELECT
    region,
    ltm_revenue,
    row_number() OVER (PARTITION BY region ORDER BY ltm_revenue DESC NULLS LAST) AS rank
  FROM marts.dim_customer
),
top_n AS (
  SELECT
    region,
    sum(ltm_revenue) FILTER (WHERE rank <= 10) AS top_10_ltm,
    sum(ltm_revenue) FILTER (WHERE rank <= 20) AS top_20_ltm,
    sum(ltm_revenue) FILTER (WHERE rank <= 50) AS top_50_ltm
  FROM ranked
  GROUP BY region
),
ltv_pct AS (
  SELECT
    region,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY lifetime_revenue) AS p25,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY lifetime_revenue) AS p50,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY lifetime_revenue) AS p75,
    percentile_cont(0.90) WITHIN GROUP (ORDER BY lifetime_revenue) AS p90,
    avg(lifetime_revenue)                                          AS mean
  FROM marts.dim_customer
  GROUP BY region
),
dc_agg AS (
  SELECT
    region,
    count(*) FILTER (WHERE days_since_last_order <= 365)  AS active_customers_ltm,
    count(*) FILTER (WHERE lapse_ratio >= 2.0)            AS cadence_churn_count,
    count(*) FILTER (WHERE days_since_last_order > 365)   AS rolling_churn_count,
    count(*) FILTER (WHERE lifetime_orders >= 2)          AS repeat_count,
    sum(coalesce(lifetime_orders, 0))                     AS total_lifetime_orders
  FROM marts.dim_customer
  GROUP BY region
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_overview_region ON marts.kpi_overview (region);

-- ─── marts.rfm_segments ────────────────────────────────────────────
-- Aggregate by (region, rfm_segment). Used by the RFM page's segment
-- table + cards.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.rfm_segments AS
SELECT
  region,
  rfm_segment,
  count(*)                  AS account_count,
  sum(ltm_revenue)          AS total_ltm_revenue,
  round(avg(ltm_revenue))   AS avg_ltm_revenue,
  array_agg(id ORDER BY ltm_revenue DESC) AS company_ids
FROM marts.dim_customer
GROUP BY region, rfm_segment;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rfm_segments_region_segment
  ON marts.rfm_segments (region, rfm_segment);

-- ─── marts.company_health ──────────────────────────────────────────
-- Aggregate by (region, health_band). Used by the /health page band
-- distribution donut.
CREATE MATERIALIZED VIEW IF NOT EXISTS marts.company_health AS
SELECT
  region,
  health_band,
  count(*)                  AS account_count,
  sum(ltm_revenue)          AS total_ltm_revenue,
  array_agg(id ORDER BY lifetime_revenue DESC) AS company_ids
FROM marts.dim_customer
GROUP BY region, health_band;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_health_region_band
  ON marts.company_health (region, health_band);

-- marts.inventory_status was removed when Phase 1 scope was reduced to
-- HubSpot-only (2026-05-13). It depended on raw_netsuite.inventory_snapshots
-- + staging.sku, both also removed. The dashboard's inventory page (if
-- exercised) falls back to mock data until Phase 2 reintroduces NetSuite.
-- ► Restoration plan + original SQL: docs/netsuite-deferred.md
