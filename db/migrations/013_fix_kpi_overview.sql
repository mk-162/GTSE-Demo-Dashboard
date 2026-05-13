-- marts.kpi_overview was producing multiple rows per region, violating
-- its UNIQUE INDEX on (region). The original query did
-- `JOIN marts.dim_customer dc ON dc.region = rt.region` and used
-- window functions like `count(*) FILTER (...) OVER (PARTITION BY ...)`
-- to compute aggregates. That gave one ROW per dim_customer record
-- (with each row carrying the same partition-aggregate values), and a
-- `LIMIT 2` was tacked on hoping to retain "one row per region". With
-- non-deterministic order, LIMIT 2 sometimes picks two rows from the
-- same region — duplicate key error on refresh.
--
-- Fix: pre-aggregate dim_customer into a CTE (proper GROUP BY region),
-- then JOIN the aggregates. One row per region by construction. No
-- LIMIT hack needed.

DROP MATERIALIZED VIEW IF EXISTS marts.kpi_overview;

CREATE MATERIALIZED VIEW marts.kpi_overview AS
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
  -- Per-region aggregates over dim_customer. ONE ROW per region by
  -- construction (GROUP BY region), so the outer JOIN below produces
  -- exactly one row per region.
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

CREATE UNIQUE INDEX idx_kpi_overview_region ON marts.kpi_overview (region);
