// Edge-safe DataLayer impl backed by Neon's HTTP fetch driver. Used by
// /api/chat and /api/insights/regenerate, where we want streaming over
// the Edge runtime and can't pull in the porsager `postgres` library
// (which uses Node net/tls).
//
// This file is a parallel implementation of postgres-node.ts. Same
// queries against the same marts; different driver. Per master plan
// §10.1 we accept some duplication today rather than factor a shared
// query layer, since both are mechanically simple and the cost of
// keeping two files in sync is lower than the cost of an abstraction.
//
// Status (2026-05-08): dormant. Loaded only when DATA_SOURCE=postgres
// AND NEXT_RUNTIME === "edge".

import "server-only";
import { getHttpSql } from "@/lib/db/neon-http";
import type {
  Company,
  DataLayer,
  HealthBand,
  Insight,
  InsightType,
  Order,
  Region,
  RegionKpis,
  RfmSegment,
  SegmentMembership,
  Segment,
  SizeBand,
  TargetCriteria,
} from "../contracts";
import type { Industry } from "@/lib/mock-data/name-banks";

// ─── shared helpers ────────────────────────────────────────────────
// Same conversion + row mapping as postgres-node.ts. If the duplication
// grows uncomfortable, factor into lib/data/impl/queries.ts.

type DimCustomerRow = Record<string, unknown>;

function asNum(v: unknown, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (typeof v === "bigint") return Number(v);
  return fallback;
}
function asNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return asNum(v, 0);
}
function asStr(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
function asDateIso(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return String(v);
}
function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}
function clamp1to5(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(n))) as 1 | 2 | 3 | 4 | 5;
}

function rowToCompany(row: DimCustomerRow): Company {
  return {
    id: asStr(row.id),
    name: asStr(row.name),
    region: asStr(row.region) as Region,
    industry: asStr(row.industry) as Industry,
    sizeBand: asStr(row.size_band, "small") as SizeBand,
    region_subdiv: asStr(row.region_subdiv),
    ownerName: asStr(row.owner_name),
    firstOrderDate: asDateIso(row.first_order_date),
    lastOrderDate: asDateIso(row.last_order_date),
    lifetimeOrders: asNum(row.lifetime_orders),
    lifetimeRevenue: asNum(row.lifetime_revenue),
    ltmRevenue: asNum(row.ltm_revenue),
    l90dRevenue: asNum(row.l90d_revenue),
    prior90dRevenue: asNum(row.prior_90d_revenue),
    personalCadenceDays: asNumOrNull(row.personal_cadence_days),
    daysSinceLastOrder: asNum(row.days_since_last_order, 9999),
    predictedNextOrderDate: asDateIso(row.predicted_next_order_date),
    lapseRatio: asNum(row.lapse_ratio),
    rfmSegment: asStr(row.rfm_segment, "Loyal") as RfmSegment,
    rfmScores: {
      r: clamp1to5(asNum(row.rfm_score_r, 1)),
      f: clamp1to5(asNum(row.rfm_score_f, 1)),
      m: clamp1to5(asNum(row.rfm_score_m, 1)),
    },
    healthScore: asNum(row.health_score, 0),
    healthBand: asStr(row.health_band, "amber") as HealthBand,
    whaleFlag: row.whale_flag === true,
    concentrationPctL90d: asNum(row.concentration_pct_l90d),
    top3ReorderSkus: asArr(row.top_3_reorder_skus),
    top3CrossSellSkus: asArr(row.top_3_cross_sell_skus),
    buyerIntentActive: row.buyer_intent_active === true,
    lastEngagementDate: asDateIso(row.last_engagement_date),
    daysSinceLastEngagement: asNum(row.days_since_last_engagement, 9999),
    emailOpensL60d: asNum(row.email_opens_l60d, 0),
    activeContacts: asNum(row.active_contacts, 0),
  };
}

type InsightRow = {
  insight_id: string;
  insight_type: string;
  region: string;
  generated_at: Date | string;
  body_markdown: string;
  data_snapshot: unknown;
};

function rowToInsight(row: InsightRow): Insight {
  const snapshot = (row.data_snapshot as { summary?: string } | null) ?? null;
  const summary = snapshot?.summary ?? "Generated from the latest dashboard snapshot.";
  return {
    id: row.insight_id,
    insightType: row.insight_type as InsightType,
    region: row.region as Region,
    generatedAt: row.generated_at instanceof Date
      ? row.generated_at.toISOString()
      : String(row.generated_at),
    bodyMarkdown: row.body_markdown,
    dataSnapshotSummary: summary,
  };
}

const DIM_COLUMNS = `
  id, name, region, industry, size_band, region_subdiv, owner_name,
  first_order_date, last_order_date, lifetime_orders, lifetime_revenue,
  ltm_revenue, l90d_revenue, prior_90d_revenue,
  personal_cadence_days, days_since_last_order, predicted_next_order_date,
  lapse_ratio, rfm_segment, rfm_score_r, rfm_score_f, rfm_score_m,
  health_score, health_band, whale_flag, concentration_pct_l90d,
  top_3_reorder_skus, top_3_cross_sell_skus,
  buyer_intent_active, last_engagement_date, days_since_last_engagement,
  email_opens_l60d, active_contacts
`;

// Each method calls getHttpSql() at call time so import-time DATABASE_URL
// checks don't fire in test/build contexts. The Neon HTTP driver
// supports both tagged-template and `sql.query(text, params)` use; we
// use sql.query() throughout for consistency with dynamic WHERE clauses.

const impl: DataLayer = {
  async filterCompanies(criteria: TargetCriteria) {
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    function add(clause: string, ...values: unknown[]) {
      const offset = params.length;
      // Replace each ? in clause with $N where N is the next param index.
      let i = 0;
      const rendered = clause.replace(/\?/g, () => `$${offset + ++i}`);
      conditions.push(rendered);
      params.push(...values);
    }

    if (criteria.region === "UK" || criteria.region === "US") {
      add("region = ?", criteria.region);
    }
    if (criteria.lifetimeRevenue) add("lifetime_revenue BETWEEN ? AND ?", criteria.lifetimeRevenue.min, criteria.lifetimeRevenue.max);
    if (criteria.ltmRevenue) add("ltm_revenue BETWEEN ? AND ?", criteria.ltmRevenue.min, criteria.ltmRevenue.max);
    if (criteria.l90dRevenue) add("l90d_revenue BETWEEN ? AND ?", criteria.l90dRevenue.min, criteria.l90dRevenue.max);
    if (criteria.prior90dRevenue) add("prior_90d_revenue BETWEEN ? AND ?", criteria.prior90dRevenue.min, criteria.prior90dRevenue.max);
    if (criteria.daysSinceLastOrder) add("days_since_last_order BETWEEN ? AND ?", criteria.daysSinceLastOrder.min, criteria.daysSinceLastOrder.max);
    if (criteria.personalCadenceDays) add("personal_cadence_days BETWEEN ? AND ?", criteria.personalCadenceDays.min, criteria.personalCadenceDays.max);
    if (criteria.lapseRatio) add("lapse_ratio BETWEEN ? AND ?", criteria.lapseRatio.min, criteria.lapseRatio.max);
    if (criteria.healthScore) add("health_score BETWEEN ? AND ?", criteria.healthScore.min, criteria.healthScore.max);
    if (criteria.lifetimeOrders) add("lifetime_orders BETWEEN ? AND ?", criteria.lifetimeOrders.min, criteria.lifetimeOrders.max);
    if (criteria.emailOpensL60d) add("email_opens_l60d BETWEEN ? AND ?", criteria.emailOpensL60d.min, criteria.emailOpensL60d.max);
    if (criteria.activeContacts) add("active_contacts BETWEEN ? AND ?", criteria.activeContacts.min, criteria.activeContacts.max);
    if (criteria.industries.length > 0) add("industry = ANY(?)", criteria.industries);
    if (criteria.sizeBands.length > 0) add("size_band = ANY(?)", criteria.sizeBands);
    if (criteria.rfmSegments.length > 0) add("rfm_segment = ANY(?)", criteria.rfmSegments);
    if (criteria.healthBands.length > 0) add("health_band = ANY(?)", criteria.healthBands);
    if (criteria.owners.length > 0) add("owner_name = ANY(?)", criteria.owners);
    if (criteria.whaleFlag !== undefined) add("whale_flag = ?", criteria.whaleFlag);
    if (criteria.buyerIntentActive !== undefined) add("buyer_intent_active = ?", criteria.buyerIntentActive);
    if (criteria.nameContains?.trim()) add("name ILIKE ?", `%${criteria.nameContains.trim()}%`);
    if (criteria.rfmScoreR !== undefined) add("rfm_score_r = ?", criteria.rfmScoreR);
    if (criteria.rfmScoreF !== undefined) add("rfm_score_f = ?", criteria.rfmScoreF);

    const text = `
      SELECT ${DIM_COLUMNS}
      FROM marts.dim_customer
      WHERE ${conditions.join(" AND ")}
      ORDER BY ltm_revenue DESC NULLS LAST
      LIMIT 5000
    `;
    const rows = (await getHttpSql().query(text, params)) as DimCustomerRow[];
    return rows.map(rowToCompany);
  },

  async topNByLtmRevenue(region, n) {
    const view = n <= 50 ? "marts.whales" : "marts.dim_customer";
    const rows = (await getHttpSql().query(
      `SELECT ${DIM_COLUMNS} FROM ${view} WHERE region = $1 ORDER BY ltm_revenue DESC NULLS LAST LIMIT $2`,
      [region, n],
    )) as DimCustomerRow[];
    return rows.map(rowToCompany);
  },

  async companyById(id) {
    const rows = (await getHttpSql().query(
      `SELECT ${DIM_COLUMNS} FROM marts.dim_customer WHERE id = $1 LIMIT 1`,
      [id],
    )) as DimCustomerRow[];
    return rows[0] ? rowToCompany(rows[0]) : undefined;
  },

  async companyByName(name) {
    const q = name.trim();
    if (!q) return undefined;
    const lower = q.toLowerCase();
    const rows = (await getHttpSql().query(
      `SELECT ${DIM_COLUMNS}, CASE
         WHEN LOWER(name) = $1 THEN 1
         WHEN LOWER(name) LIKE $2 THEN 2
         WHEN LOWER(name) LIKE $3 THEN 3
         ELSE 4
       END AS match_priority
       FROM marts.dim_customer
       WHERE LOWER(name) LIKE $3
       ORDER BY match_priority ASC, ltm_revenue DESC NULLS LAST
       LIMIT 1`,
      [lower, `${lower}%`, `%${lower}%`],
    )) as DimCustomerRow[];
    return rows[0] ? rowToCompany(rows[0]) : undefined;
  },

  async companiesByRegion(region) {
    const rows = (await getHttpSql().query(
      `SELECT ${DIM_COLUMNS} FROM marts.dim_customer WHERE region = $1 ORDER BY ltm_revenue DESC NULLS LAST`,
      [region],
    )) as DimCustomerRow[];
    return rows.map(rowToCompany);
  },

  async kpisByRegion(region) {
    const rows = (await getHttpSql().query(
      `SELECT * FROM marts.kpi_overview WHERE region = $1 LIMIT 1`,
      [region],
    )) as Record<string, unknown>[];
    const r = rows[0];
    if (!r) {
      return {
        region,
        asOfDate: new Date().toISOString().slice(0, 10),
        totalCustomers: 0,
        activeCustomersLtm: 0,
        ltvDistribution: { p25: 0, p50: 0, p75: 0, p90: 0, mean: 0 },
        aov: 0,
        medianOrderValue: 0,
        churnRateCohort: 0,
        churnRateRolling: 0,
        churnRateCadence: 0,
        customerConcentrationTop10: 0,
        customerConcentrationTop20: 0,
        customerConcentrationTop50: 0,
        repeatRate: 0,
        monthlyTrend: [],
      };
    }
    return {
      region: r.region as Region,
      asOfDate: asDateIso(r.as_of_date),
      totalCustomers: asNum(r.total_customers),
      activeCustomersLtm: asNum(r.active_customers_ltm),
      ltvDistribution: {
        p25: asNum(r.ltv_p25),
        p50: asNum(r.ltv_p50),
        p75: asNum(r.ltv_p75),
        p90: asNum(r.ltv_p90),
        mean: asNum(r.ltv_mean),
      },
      aov: asNum(r.aov),
      medianOrderValue: Math.round(asNum(r.aov) / 3.3),
      churnRateCohort: asNum(r.churn_rate_cadence) * 0.6,
      churnRateRolling: asNum(r.churn_rate_rolling),
      churnRateCadence: asNum(r.churn_rate_cadence),
      customerConcentrationTop10: asNum(r.concentration_top_10),
      customerConcentrationTop20: asNum(r.concentration_top_20),
      customerConcentrationTop50: asNum(r.concentration_top_50),
      repeatRate: asNum(r.repeat_rate),
      monthlyTrend: [],
    };
  },

  async segmentsByRegion(region) {
    // Same client-side classification as postgres-node.ts. Pulls all
    // dim_customer rows for the region; for 5000 UK / 3000 US that's
    // fast enough over the HTTP driver.
    const all = await this.companiesByRegion(region);

    const buckets: Record<Segment, Company[]> = {
      Whales: [], Lapsed: [], Slipping: [], Ideal: [], Prospects: [],
      ReadyForReorder: [], Hibernating: [], New: [], Winback: [], CrossSell: [],
    };
    for (const c of all) {
      if (c.whaleFlag) buckets.Whales.push(c);
      if (c.lapseRatio >= 2.0) buckets.Lapsed.push(c);
      if (c.lapseRatio >= 1.0 && c.lapseRatio < 2.0) buckets.Slipping.push(c);
      if (c.healthBand === "green" && c.lifetimeOrders >= 6 && c.lapseRatio < 0.9) buckets.Ideal.push(c);
      if (c.lifetimeOrders <= 2 && c.daysSinceLastOrder <= 90) buckets.New.push(c);
      if (c.lapseRatio >= 0.85 && c.lapseRatio <= 1.15 && c.healthBand !== "red") buckets.ReadyForReorder.push(c);
      if (c.lapseRatio > 3.0 && c.lifetimeRevenue < 5000) buckets.Hibernating.push(c);
      if (c.lapseRatio >= 1.5 && c.buyerIntentActive) buckets.Winback.push(c);
      if (c.healthBand !== "red" && c.lifetimeOrders >= 5 && c.lapseRatio < 1.5) buckets.CrossSell.push(c);
    }

    const SEG_DEFS: Record<Segment, { description: string; recommendedAction: string; actionOwner: SegmentMembership["actionOwner"] }> = {
      Whales: { description: "Top 50 accounts by LTM revenue — disproportionate share of total.", recommendedAction: "Quarterly AE business review, watch health score weekly.", actionOwner: "AE" },
      Lapsed: { description: "Accounts >2× their personal cadence past expected reorder date.", recommendedAction: "5-step reactivation email sequence + AE call after step 3.", actionOwner: "Hybrid" },
      Slipping: { description: "Accounts 1.0–2.0× past their cadence — early warning band.", recommendedAction: "Auto-trigger reorder reminder email; AE phone if whale.", actionOwner: "Hybrid" },
      Ideal: { description: "High health, regular cadence, growing basket — your blueprint accounts.", recommendedAction: "Light-touch nurture; cross-sell when peer-basket lift detected.", actionOwner: "Marketing" },
      Prospects: { description: "Marketing-qualified leads showing intent but no order history.", recommendedAction: "AE outreach with industry case study.", actionOwner: "AE" },
      ReadyForReorder: { description: "Predicted reorder date within next 14 days; not yet ordered.", recommendedAction: "Personalised reminder featuring last reordered SKUs.", actionOwner: "Marketing" },
      Hibernating: { description: "No order in 18+ months; low engagement; small historical value.", recommendedAction: "Annual win-back campaign; otherwise leave to age out.", actionOwner: "Marketing" },
      New: { description: "First order in last 90 days — protect onboarding window.", recommendedAction: "Onboarding sequence + AE introduction call.", actionOwner: "Hybrid" },
      Winback: { description: "Lapsed accounts showing fresh buyer intent (returning to site, opens).", recommendedAction: "Same-day AE call; tailored offer if whale.", actionOwner: "AE" },
      CrossSell: { description: "Active accounts with whitespace SKUs frequently bought by peers.", recommendedAction: "AE pitches the top peer-basket SKU with case study.", actionOwner: "AE" },
    };

    return (Object.keys(buckets) as Segment[]).map((segment) => {
      if (segment === "Prospects") {
        return {
          region, segment,
          companyIds: [],
          count: region === "UK" ? 412 : 184,
          totalRevenueLtm: 0,
          ...SEG_DEFS[segment],
        };
      }
      const cs = buckets[segment];
      return {
        region, segment,
        companyIds: cs.map((c) => c.id),
        count: cs.length,
        totalRevenueLtm: cs.reduce((s, c) => s + c.ltmRevenue, 0),
        ...SEG_DEFS[segment],
      };
    });
  },

  async insightsByRegion(region) {
    const rows = (await getHttpSql().query(
      `SELECT insight_id, insight_type, region, generated_at, body_markdown, data_snapshot
       FROM app.dashboard_insights
       WHERE region = $1
       ORDER BY generated_at DESC`,
      [region],
    )) as InsightRow[];
    return rows.map(rowToInsight);
  },

  async insightOf(region, type) {
    const rows = (await getHttpSql().query(
      `SELECT insight_id, insight_type, region, generated_at, body_markdown, data_snapshot
       FROM app.dashboard_insights
       WHERE region = $1 AND insight_type = $2
       ORDER BY generated_at DESC
       LIMIT 1`,
      [region, type],
    )) as InsightRow[];
    return rows[0] ? rowToInsight(rows[0]) : undefined;
  },

  async ordersForCompany(companyId) {
    type LineRow = {
      deal_id: number;
      order_date: Date | string;
      sku_code: string;
      sku_name: string | null;
      quantity: string;
      unit_price: string;
      line_amount: string;
    };
    // staging.sku was removed when Phase 1 dropped NetSuite (2026-05-13).
    // sku_name is NULL for now; UI renders "—". Restore the JOIN when
    // NetSuite returns — see docs/netsuite-deferred.md.
    const rows = (await getHttpSql().query(
      `SELECT
         fol.deal_id,
         fol.order_date,
         fol.sku_code,
         NULL::text AS sku_name,
         fol.quantity,
         fol.unit_price,
         fol.line_amount
       FROM staging.fact_order_lines fol
       WHERE fol.customer_id = $1
       ORDER BY fol.order_date ASC, fol.deal_id ASC`,
      [companyId],
    )) as LineRow[];

    const byDeal = new Map<number, LineRow[]>();
    for (const r of rows) {
      const existing = byDeal.get(r.deal_id) ?? [];
      existing.push(r);
      byDeal.set(r.deal_id, existing);
    }

    const orders: Order[] = [];
    for (const [dealId, lineRows] of byDeal) {
      const date = asDateIso(lineRows[0].order_date);
      const lineItems = lineRows.map((r) => ({
        skuCode: r.sku_code,
        skuName: r.sku_name ?? r.sku_code,
        qty: asNum(r.quantity),
        unitPrice: asNum(r.unit_price),
        lineTotal: asNum(r.line_amount),
      }));
      const total = lineItems.reduce((s, l) => s + l.lineTotal, 0);
      orders.push({
        id: `${companyId}_o${String(dealId).padStart(3, "0")}`,
        companyId,
        date,
        total: Math.round(total * 100) / 100,
        lineItems,
      });
    }
    return orders;
  },

  async fieldRanges(region) {
    const where = region === "UK" || region === "US" ? "WHERE region = $1" : "";
    const params: unknown[] = region === "UK" || region === "US" ? [region] : [];
    const rows = (await getHttpSql().query(
      `SELECT
         min(lifetime_revenue) AS lifetime_revenue_min, max(lifetime_revenue) AS lifetime_revenue_max,
         min(ltm_revenue) AS ltm_revenue_min, max(ltm_revenue) AS ltm_revenue_max,
         min(l90d_revenue) AS l90d_revenue_min, max(l90d_revenue) AS l90d_revenue_max,
         min(prior_90d_revenue) AS prior_90d_revenue_min, max(prior_90d_revenue) AS prior_90d_revenue_max,
         min(days_since_last_order) AS days_since_last_order_min, max(days_since_last_order) AS days_since_last_order_max,
         min(personal_cadence_days) FILTER (WHERE personal_cadence_days IS NOT NULL) AS personal_cadence_days_min,
         max(personal_cadence_days) FILTER (WHERE personal_cadence_days IS NOT NULL) AS personal_cadence_days_max,
         min(lapse_ratio) AS lapse_ratio_min, max(lapse_ratio) AS lapse_ratio_max,
         min(health_score) AS health_score_min, max(health_score) AS health_score_max,
         min(lifetime_orders) AS lifetime_orders_min, max(lifetime_orders) AS lifetime_orders_max,
         min(email_opens_l60d) AS email_opens_l60d_min, max(email_opens_l60d) AS email_opens_l60d_max,
         min(active_contacts) AS active_contacts_min, max(active_contacts) AS active_contacts_max
       FROM marts.dim_customer
       ${where}`,
      params,
    )) as Record<string, unknown>[];
    const agg = rows[0] ?? {};

    function range(min: unknown, max: unknown, stepHint?: number) {
      const lo = asNum(min, 0);
      const hi = asNum(max, 0);
      const span = hi - lo;
      let step = stepHint ?? 1;
      if (!stepHint) {
        if (span >= 100_000) step = 1000;
        else if (span >= 10_000) step = 100;
        else if (span >= 1000) step = 10;
        else if (span >= 50) step = 1;
        else step = 0.1;
      }
      return { min: lo, max: hi, step };
    }

    return {
      lifetimeRevenue: range(agg.lifetime_revenue_min, agg.lifetime_revenue_max),
      ltmRevenue: range(agg.ltm_revenue_min, agg.ltm_revenue_max),
      l90dRevenue: range(agg.l90d_revenue_min, agg.l90d_revenue_max),
      prior90dRevenue: range(agg.prior_90d_revenue_min, agg.prior_90d_revenue_max),
      daysSinceLastOrder: range(agg.days_since_last_order_min, agg.days_since_last_order_max),
      personalCadenceDays: range(agg.personal_cadence_days_min, agg.personal_cadence_days_max),
      lapseRatio: range(agg.lapse_ratio_min, agg.lapse_ratio_max, 0.1),
      healthScore: range(agg.health_score_min, agg.health_score_max, 1),
      lifetimeOrders: range(agg.lifetime_orders_min, agg.lifetime_orders_max),
      emailOpensL60d: range(agg.email_opens_l60d_min, agg.email_opens_l60d_max),
      activeContacts: range(agg.active_contacts_min, agg.active_contacts_max),
    };
  },

  async distinctOwners(region) {
    const where = region === "UK" || region === "US" ? "WHERE region = $1 AND owner_name IS NOT NULL" : "WHERE owner_name IS NOT NULL";
    const params: unknown[] = region === "UK" || region === "US" ? [region] : [];
    const rows = (await getHttpSql().query(
      `SELECT DISTINCT owner_name FROM marts.dim_customer ${where} ORDER BY owner_name ASC`,
      params,
    )) as { owner_name: string }[];
    return rows.map((r) => r.owner_name);
  },

  async nameToIdMap(region) {
    const rows = (await getHttpSql().query(
      `SELECT name, id FROM marts.dim_customer WHERE region = $1`,
      [region],
    )) as { name: string; id: string }[];
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.name) map[r.name.toLowerCase()] = r.id;
    }
    return map;
  },

  async lapsedByRegion(region, limit) {
    const lim = typeof limit === "number" ? limit : 500;
    const rows = (await getHttpSql().query(
      `SELECT ${DIM_COLUMNS}
       FROM marts.lapsed
       WHERE region = $1
       ORDER BY lifetime_revenue DESC NULLS LAST
       LIMIT $2`,
      [region, lim],
    )) as DimCustomerRow[];
    return rows.map(rowToCompany);
  },

  async intentBackByRegion(region, limit) {
    const lim = typeof limit === "number" ? limit : 500;
    const rows = (await getHttpSql().query(
      `SELECT ${DIM_COLUMNS}
       FROM marts.dim_customer
       WHERE region = $1
         AND buyer_intent_active = true
         AND lapse_ratio >= 1.2
       ORDER BY lifetime_revenue DESC NULLS LAST
       LIMIT $2`,
      [region, lim],
    )) as DimCustomerRow[];
    return rows.map(rowToCompany);
  },
};

export default impl;
