import type { Company } from "./mock-data/companies";

/**
 * Convert internal Company shape to the snake_case JSON format the public
 * API exposes. Keep this stable across versions — once external clients
 * depend on field names we can't rename them without bumping the API version.
 */
export function serialiseCompany(c: Company) {
  return {
    id: c.id,
    name: c.name,
    region: c.region,
    industry: c.industry,
    size_band: c.sizeBand,
    region_subdiv: c.region_subdiv,
    owner_name: c.ownerName,
    first_order_date: c.firstOrderDate,
    last_order_date: c.lastOrderDate,
    lifetime_orders: c.lifetimeOrders,
    lifetime_revenue: c.lifetimeRevenue,
    ltm_revenue: c.ltmRevenue,
    l90d_revenue: c.l90dRevenue,
    prior_90d_revenue: c.prior90dRevenue,
    personal_cadence_days: c.personalCadenceDays,
    days_since_last_order: c.daysSinceLastOrder,
    predicted_next_order_date: c.predictedNextOrderDate,
    lapse_ratio: c.lapseRatio,
    rfm_segment: c.rfmSegment,
    rfm_scores: c.rfmScores,
    health_score: c.healthScore,
    health_band: c.healthBand,
    whale_flag: c.whaleFlag,
    concentration_pct_l90d: c.concentrationPctL90d,
    top_3_reorder_skus: c.top3ReorderSkus,
    top_3_cross_sell_skus: c.top3CrossSellSkus,
    buyer_intent_active: c.buyerIntentActive,
    last_engagement_date: c.lastEngagementDate,
    days_since_last_engagement: c.daysSinceLastEngagement,
    email_opens_l60d: c.emailOpensL60d,
    active_contacts: c.activeContacts,
  };
}
