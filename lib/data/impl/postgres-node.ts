// Node-only DataLayer impl backed by Postgres. Used by /api/internal/*,
// /api/v1/* (post-M5 runtime flip), all /api/cron/*, and any Server
// Component that ends up rendering server-side in Node context.
//
// All queries hit marts.* (materialised, refreshed by /api/cron/transform)
// or staging.fact_order_lines (a plain VIEW joined live). Imports only
// from lib/db/postgres-pool.ts — never touches @neondatabase/serverless,
// keeping the postgres library out of any Edge bundle.
//
// Status (2026-05-08): dormant. Loaded only when DATA_SOURCE=postgres on
// production. The marts referenced here exist as definitions in
// db/migrations/007_marts.sql but the materialised views aren't
// populated until /api/cron/transform runs against a real DB.

import "server-only";
import { getPool } from "@/lib/db/postgres-pool";
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

// ─── row mappers ───────────────────────────────────────────────────
// Postgres returns numerics + bigints as strings (JS numbers can't
// safely represent the full numeric range). We coerce explicitly so
// the Company shape matches the TypeScript type rather than leaking
// strings into UI math.

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
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
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

function clamp1to5(n: number): 1 | 2 | 3 | 4 | 5 {
  const i = Math.max(1, Math.min(5, Math.round(n)));
  return i as 1 | 2 | 3 | 4 | 5;
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
  // data_snapshot_summary isn't a separate column; derive from the JSONB
  // payload. The M6 cron stores a `summary` field on the snapshot when
  // available; falls back to a generic when absent.
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

// ─── filterCompanies ───────────────────────────────────────────────
// Builds the WHERE clause incrementally from the criteria. Each
// criterion is a conditional sql fragment; postgres-js concatenates
// them safely.

const SELECT_DIM = `
  SELECT
    id, name, region, industry, size_band, region_subdiv, owner_name,
    first_order_date, last_order_date, lifetime_orders, lifetime_revenue,
    ltm_revenue, l90d_revenue, prior_90d_revenue,
    personal_cadence_days, days_since_last_order, predicted_next_order_date,
    lapse_ratio, rfm_segment, rfm_score_r, rfm_score_f, rfm_score_m,
    health_score, health_band, whale_flag, concentration_pct_l90d,
    top_3_reorder_skus, top_3_cross_sell_skus,
    buyer_intent_active, last_engagement_date, days_since_last_engagement,
    email_opens_l60d, active_contacts
  FROM marts.dim_customer
`;

const impl: DataLayer = {
  async filterCompanies(criteria: TargetCriteria) {
    const sql = getPool();
    const parts: ReturnType<typeof sql>[] = [];

    if (criteria.region === "UK" || criteria.region === "US") {
      parts.push(sql`AND region = ${criteria.region}`);
    }
    if (criteria.lifetimeRevenue) {
      parts.push(sql`AND lifetime_revenue BETWEEN ${criteria.lifetimeRevenue.min} AND ${criteria.lifetimeRevenue.max}`);
    }
    if (criteria.ltmRevenue) {
      parts.push(sql`AND ltm_revenue BETWEEN ${criteria.ltmRevenue.min} AND ${criteria.ltmRevenue.max}`);
    }
    if (criteria.l90dRevenue) {
      parts.push(sql`AND l90d_revenue BETWEEN ${criteria.l90dRevenue.min} AND ${criteria.l90dRevenue.max}`);
    }
    if (criteria.prior90dRevenue) {
      parts.push(sql`AND prior_90d_revenue BETWEEN ${criteria.prior90dRevenue.min} AND ${criteria.prior90dRevenue.max}`);
    }
    if (criteria.daysSinceLastOrder) {
      parts.push(sql`AND days_since_last_order BETWEEN ${criteria.daysSinceLastOrder.min} AND ${criteria.daysSinceLastOrder.max}`);
    }
    if (criteria.personalCadenceDays) {
      parts.push(sql`AND personal_cadence_days BETWEEN ${criteria.personalCadenceDays.min} AND ${criteria.personalCadenceDays.max}`);
    }
    if (criteria.lapseRatio) {
      parts.push(sql`AND lapse_ratio BETWEEN ${criteria.lapseRatio.min} AND ${criteria.lapseRatio.max}`);
    }
    if (criteria.healthScore) {
      parts.push(sql`AND health_score BETWEEN ${criteria.healthScore.min} AND ${criteria.healthScore.max}`);
    }
    if (criteria.lifetimeOrders) {
      parts.push(sql`AND lifetime_orders BETWEEN ${criteria.lifetimeOrders.min} AND ${criteria.lifetimeOrders.max}`);
    }
    if (criteria.emailOpensL60d) {
      parts.push(sql`AND email_opens_l60d BETWEEN ${criteria.emailOpensL60d.min} AND ${criteria.emailOpensL60d.max}`);
    }
    if (criteria.activeContacts) {
      parts.push(sql`AND active_contacts BETWEEN ${criteria.activeContacts.min} AND ${criteria.activeContacts.max}`);
    }
    if (criteria.industries.length > 0) {
      parts.push(sql`AND industry = ANY(${criteria.industries})`);
    }
    if (criteria.sizeBands.length > 0) {
      parts.push(sql`AND size_band = ANY(${criteria.sizeBands})`);
    }
    if (criteria.rfmSegments.length > 0) {
      parts.push(sql`AND rfm_segment = ANY(${criteria.rfmSegments})`);
    }
    if (criteria.healthBands.length > 0) {
      parts.push(sql`AND health_band = ANY(${criteria.healthBands})`);
    }
    if (criteria.owners.length > 0) {
      parts.push(sql`AND owner_name = ANY(${criteria.owners})`);
    }
    if (criteria.whaleFlag !== undefined) {
      parts.push(sql`AND whale_flag = ${criteria.whaleFlag}`);
    }
    if (criteria.buyerIntentActive !== undefined) {
      parts.push(sql`AND buyer_intent_active = ${criteria.buyerIntentActive}`);
    }
    if (criteria.nameContains && criteria.nameContains.trim()) {
      parts.push(sql`AND name ILIKE ${`%${criteria.nameContains.trim()}%`}`);
    }
    if (criteria.rfmScoreR !== undefined) {
      parts.push(sql`AND rfm_score_r = ${criteria.rfmScoreR}`);
    }
    if (criteria.rfmScoreF !== undefined) {
      parts.push(sql`AND rfm_score_f = ${criteria.rfmScoreF}`);
    }

    // Compose the AND clauses into a single sql fragment. postgres-js
    // keeps each value parameterised so this stays injection-safe.
    const dynamic = parts.reduce((acc, p) => sql`${acc} ${p}`, sql``);
    const rows = await sql<DimCustomerRow[]>`
      ${sql.unsafe(SELECT_DIM)}
      WHERE 1=1 ${dynamic}
      ORDER BY ltm_revenue DESC NULLS LAST
      LIMIT 5000
    `;
    return rows.map(rowToCompany);
  },

  async topNByLtmRevenue(region, n) {
    const sql = getPool();
    // marts.whales is already top-50 per region. For n <= 50 we can read
    // directly; for larger n fall back to dim_customer.
    if (n <= 50) {
      const rows = await sql<DimCustomerRow[]>`
        ${sql.unsafe(SELECT_DIM.replace("FROM marts.dim_customer", "FROM marts.whales"))}
        WHERE region = ${region}
        ORDER BY ltm_revenue DESC NULLS LAST
        LIMIT ${n}
      `;
      return rows.map(rowToCompany);
    }
    const rows = await sql<DimCustomerRow[]>`
      ${sql.unsafe(SELECT_DIM)}
      WHERE region = ${region}
      ORDER BY ltm_revenue DESC NULLS LAST
      LIMIT ${n}
    `;
    return rows.map(rowToCompany);
  },

  async companyById(id) {
    const sql = getPool();
    const rows = await sql<DimCustomerRow[]>`
      ${sql.unsafe(SELECT_DIM)}
      WHERE id = ${id}
      LIMIT 1
    `;
    return rows[0] ? rowToCompany(rows[0]) : undefined;
  },

  async companyByName(name) {
    const sql = getPool();
    const q = name.trim();
    if (!q) return undefined;
    // Exact (case-insensitive) → prefix → substring fallback, mirroring
    // memoryImpl. Single query with priority ordering avoids 3 round-trips.
    const lower = q.toLowerCase();
    const rows = await sql<(DimCustomerRow & { match_priority: number })[]>`
      ${sql.unsafe(SELECT_DIM)}, CASE
        WHEN LOWER(name) = ${lower} THEN 1
        WHEN LOWER(name) LIKE ${`${lower}%`} THEN 2
        WHEN LOWER(name) LIKE ${`%${lower}%`} THEN 3
        ELSE 4
      END AS match_priority
      WHERE LOWER(name) LIKE ${`%${lower}%`}
      ORDER BY match_priority ASC, ltm_revenue DESC NULLS LAST
      LIMIT 1
    `;
    return rows[0] ? rowToCompany(rows[0]) : undefined;
  },

  async companiesByRegion(region) {
    const sql = getPool();
    const rows = await sql<DimCustomerRow[]>`
      ${sql.unsafe(SELECT_DIM)}
      WHERE region = ${region}
      ORDER BY ltm_revenue DESC NULLS LAST
    `;
    return rows.map(rowToCompany);
  },

  async kpisByRegion(region) {
    const sql = getPool();
    const rows = await sql<Record<string, unknown>[]>`
      SELECT * FROM marts.kpi_overview WHERE region = ${region} LIMIT 1
    `;
    const r = rows[0];
    if (!r) {
      // Fail-safe defaults if the mart hasn't been refreshed yet — keeps
      // the dashboard rendering rather than 500-ing.
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
      // medianOrderValue not yet a column in kpi_overview — derive
      // approx from aov / 3.3 (matches the mock data's median:AOV ratio).
      medianOrderValue: Math.round(asNum(r.aov) / 3.3),
      churnRateCohort: asNum(r.churn_rate_cadence) * 0.6, // approximation
      churnRateRolling: asNum(r.churn_rate_rolling),
      churnRateCadence: asNum(r.churn_rate_cadence),
      customerConcentrationTop10: asNum(r.concentration_top_10),
      customerConcentrationTop20: asNum(r.concentration_top_20),
      customerConcentrationTop50: asNum(r.concentration_top_50),
      repeatRate: asNum(r.repeat_rate),
      // monthlyTrend not yet a column — empty until we add a per-region
      // monthly_revenue rollup mart.
      monthlyTrend: [],
    };
  },

  async segmentsByRegion(region) {
    // Phase-2 segments derive from dim_customer attributes via the same
    // classification logic as lib/mock-data/segments.ts. Pull all rows
    // for the region, classify client-side. For 5000 UK / 3000 US rows
    // this is well under 1 second.
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

    const segments = (Object.keys(buckets) as Segment[]).map((segment) => {
      if (segment === "Prospects") {
        // Prospects are MQLs not in the order book — synthesised count
        // until we have a real MQL feed (HubSpot Marketing Hub).
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

    return segments;
  },

  async insightsByRegion(region) {
    const sql = getPool();
    const rows = await sql<InsightRow[]>`
      SELECT insight_id, insight_type, region, generated_at, body_markdown, data_snapshot
      FROM app.dashboard_insights
      WHERE region = ${region}
      ORDER BY generated_at DESC
    `;
    return rows.map(rowToInsight);
  },

  async insightOf(region, type) {
    const sql = getPool();
    const rows = await sql<InsightRow[]>`
      SELECT insight_id, insight_type, region, generated_at, body_markdown, data_snapshot
      FROM app.dashboard_insights
      WHERE region = ${region} AND insight_type = ${type}
      ORDER BY generated_at DESC
      LIMIT 1
    `;
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

    const sql = getPool();
    // staging.sku was removed when Phase 1 dropped NetSuite (2026-05-13)
    // — see docs/netsuite-deferred.md. sku_name comes back as NULL for
    // now; the dashboard's account page renders "—" when name is null.
    // Restore the LEFT JOIN to staging.sku when NetSuite returns.
    const rows = await sql<LineRow[]>`
      SELECT
        fol.deal_id,
        fol.order_date,
        fol.sku_code,
        NULL::text AS sku_name,
        fol.quantity,
        fol.unit_price,
        fol.line_amount
      FROM staging.fact_order_lines fol
      WHERE fol.customer_id = ${companyId}
      ORDER BY fol.order_date ASC, fol.deal_id ASC
    `;

    // Group rows into orders. One order = one deal_id; lines are the
    // children.
    const byDeal = new Map<number, LineRow[]>();
    for (const r of rows as unknown as LineRow[]) {
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
    const sql = getPool();
    const where = region === "UK" || region === "US"
      ? sql`WHERE region = ${region}`
      : sql``;
    const [agg] = await sql<{
      lifetime_revenue_min: string; lifetime_revenue_max: string;
      ltm_revenue_min: string; ltm_revenue_max: string;
      l90d_revenue_min: string; l90d_revenue_max: string;
      prior_90d_revenue_min: string; prior_90d_revenue_max: string;
      days_since_last_order_min: string; days_since_last_order_max: string;
      personal_cadence_days_min: string; personal_cadence_days_max: string;
      lapse_ratio_min: string; lapse_ratio_max: string;
      health_score_min: string; health_score_max: string;
      lifetime_orders_min: string; lifetime_orders_max: string;
      email_opens_l60d_min: string; email_opens_l60d_max: string;
      active_contacts_min: string; active_contacts_max: string;
    }[]>`
      SELECT
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
      ${where}
    `;

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
    const sql = getPool();
    const where = region === "UK" || region === "US"
      ? sql`WHERE region = ${region}`
      : sql``;
    const rows = await sql<{ owner_name: string }[]>`
      SELECT DISTINCT owner_name FROM marts.dim_customer ${where}
      WHERE owner_name IS NOT NULL
      ORDER BY owner_name ASC
    `;
    return rows.map((r) => r.owner_name);
  },

  async nameToIdMap(region) {
    const sql = getPool();
    const rows = await sql<{ name: string; id: string }[]>`
      SELECT name, id FROM marts.dim_customer WHERE region = ${region}
    `;
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.name) map[r.name.toLowerCase()] = r.id;
    }
    return map;
  },

  async lapsedByRegion(region, limit) {
    const sql = getPool();
    const lim = typeof limit === "number" ? limit : 500;
    const rows = await sql<DimCustomerRow[]>`
      ${sql.unsafe(SELECT_DIM.replace("FROM marts.dim_customer", "FROM marts.lapsed"))}
      WHERE region = ${region}
      ORDER BY lifetime_revenue DESC NULLS LAST
      LIMIT ${lim}
    `;
    return rows.map(rowToCompany);
  },

  async intentBackByRegion(region, limit) {
    const sql = getPool();
    const lim = typeof limit === "number" ? limit : 500;
    const rows = await sql<DimCustomerRow[]>`
      ${sql.unsafe(SELECT_DIM)}
      WHERE region = ${region}
        AND buyer_intent_active = true
        AND lapse_ratio >= 1.2
      ORDER BY lifetime_revenue DESC NULLS LAST
      LIMIT ${lim}
    `;
    return rows.map(rowToCompany);
  },
};

export default impl;
