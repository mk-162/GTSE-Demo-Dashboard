import { kpisByRegion } from "@/lib/mock-data/kpis";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/kpis?region=UK | US
 *
 * Returns headline KPIs and the 12-month revenue trend for one region.
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const region = url.searchParams.get("region") === "US" ? "US" : "UK";
  const k = kpisByRegion(region);

  return jsonResponse({
    region: k.region,
    as_of_date: k.asOfDate,
    total_customers: k.totalCustomers,
    active_customers_ltm: k.activeCustomersLtm,
    ltv_distribution: k.ltvDistribution,
    aov: k.aov,
    median_order_value: k.medianOrderValue,
    churn_rate_cohort: k.churnRateCohort,
    churn_rate_rolling: k.churnRateRolling,
    churn_rate_cadence: k.churnRateCadence,
    customer_concentration: {
      top_10: k.customerConcentrationTop10,
      top_20: k.customerConcentrationTop20,
      top_50: k.customerConcentrationTop50,
    },
    repeat_rate: k.repeatRate,
    monthly_trend: k.monthlyTrend,
  });
}
