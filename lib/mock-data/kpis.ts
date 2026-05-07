import { COMPANIES_UK, COMPANIES_US, type Company } from "./companies";
import { createRng, gaussian } from "./rng";

export type RegionKpis = {
  region: "UK" | "US";
  asOfDate: string;
  totalCustomers: number;
  activeCustomersLtm: number;
  ltvDistribution: { p25: number; p50: number; p75: number; p90: number; mean: number };
  aov: number;
  medianOrderValue: number;
  churnRateCohort: number;
  churnRateRolling: number;
  churnRateCadence: number;
  customerConcentrationTop10: number;
  customerConcentrationTop20: number;
  customerConcentrationTop50: number;
  repeatRate: number;
  monthlyTrend: {
    month: string;
    revenue: number;
    orders: number;
    activeCustomers: number;
    newCustomers: number;
  }[];
};

const TODAY = new Date("2026-05-07");
const MONTH_LABELS = (() => {
  const out: { iso: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    const month = d.toLocaleString("en-GB", { month: "short" });
    out.push({ iso: d.toISOString().slice(0, 7), label: `${month} ${d.getFullYear()}` });
  }
  return out;
})();

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[i];
}

function buildKpis(region: "UK" | "US"): RegionKpis {
  const companies: Company[] = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  const rng = createRng(region === "UK" ? 99001 : 99002);

  const totalCustomers = companies.length;
  const activeCustomersLtm = companies.filter((c) => c.daysSinceLastOrder <= 365).length;

  const ltvSorted = companies.map((c) => c.lifetimeRevenue).sort((a, b) => a - b);
  const ltvDistribution = {
    p25: Math.round(percentile(ltvSorted, 25)),
    p50: Math.round(percentile(ltvSorted, 50)),
    p75: Math.round(percentile(ltvSorted, 75)),
    p90: Math.round(percentile(ltvSorted, 90)),
    mean: Math.round(ltvSorted.reduce((s, v) => s + v, 0) / Math.max(1, ltvSorted.length)),
  };

  const totalLtmOrders = companies.reduce((s, c) => {
    if (c.daysSinceLastOrder > 365) return s;
    const cadence = c.personalCadenceDays ?? 180;
    return s + Math.max(1, Math.round(365 / cadence));
  }, 0);
  const totalLtmRevenue = companies.reduce((s, c) => s + c.ltmRevenue, 0);

  const aov = Math.round(totalLtmRevenue / Math.max(1, totalLtmOrders));

  const orderValues: number[] = [];
  for (const c of companies) {
    if (c.daysSinceLastOrder > 365) continue;
    const cadence = c.personalCadenceDays ?? 180;
    const orderCount = Math.max(1, Math.round(365 / cadence));
    const orderValue = c.ltmRevenue / orderCount;
    for (let i = 0; i < Math.min(orderCount, 8); i++) {
      orderValues.push(orderValue * (0.7 + 0.6 * rng()));
    }
  }
  orderValues.sort((a, b) => a - b);
  const medianOrderValue = Math.round(percentile(orderValues, 50));

  // Customer concentration
  const sortedByLtm = [...companies].sort((a, b) => b.ltmRevenue - a.ltmRevenue);
  const total = sortedByLtm.reduce((s, c) => s + c.ltmRevenue, 0) || 1;
  const sumTop = (n: number) => sortedByLtm.slice(0, n).reduce((s, c) => s + c.ltmRevenue, 0);
  const customerConcentrationTop10 = Math.round((sumTop(10) / total) * 1000) / 10;
  const customerConcentrationTop20 = Math.round((sumTop(20) / total) * 1000) / 10;
  const customerConcentrationTop50 = Math.round((sumTop(50) / total) * 1000) / 10;

  // Churn rates
  const lapsedCount = companies.filter((c) => c.lapseRatio >= 2.0).length;
  const slippingCount = companies.filter((c) => c.lapseRatio >= 1.0).length;
  const inactiveYearCount = companies.filter((c) => c.daysSinceLastOrder > 365).length;

  const churnRateCadence = Math.round((lapsedCount / totalCustomers) * 1000) / 10;
  const churnRateRolling = Math.round((inactiveYearCount / totalCustomers) * 1000) / 10;
  const churnRateCohort = Math.round((slippingCount / totalCustomers) * 1000) / 10;

  const repeatableCount = companies.filter((c) => c.lifetimeOrders >= 2).length;
  const repeatRate = Math.round((repeatableCount / totalCustomers) * 1000) / 10;

  // Monthly trend — build a 12-month series with gentle growth + uptick in churn last 3 months
  const baseRevenue = totalLtmRevenue / 12;
  const monthlyTrend = MONTH_LABELS.map((m, i) => {
    // Gentle growth: 0.92x at start, 1.06x at end
    const growthFactor = 0.92 + (i / 11) * 0.14;
    const seasonal = Math.sin((i / 11) * Math.PI) * 0.05;
    const noise = gaussian(rng, 0, 0.04);
    const revenue = Math.round(baseRevenue * (growthFactor + seasonal + noise));

    const orderCountBase = totalLtmOrders / 12;
    const orders = Math.round(orderCountBase * (growthFactor + seasonal + noise * 0.5));

    // Active customers — slight dip in last 3 months for the churn story
    let activeFactor = 1.0;
    if (i === 9) activeFactor = 0.97;
    else if (i === 10) activeFactor = 0.94;
    else if (i === 11) activeFactor = 0.91;
    const activeCustomers = Math.round(activeCustomersLtm * activeFactor);

    const newCustomers = Math.round(8 + rng() * 6 + (region === "UK" ? 4 : 2));
    return { month: m.label, revenue, orders, activeCustomers, newCustomers };
  });

  return {
    region,
    asOfDate: TODAY.toISOString().slice(0, 10),
    totalCustomers,
    activeCustomersLtm,
    ltvDistribution,
    aov,
    medianOrderValue,
    churnRateCohort,
    churnRateRolling,
    churnRateCadence,
    customerConcentrationTop10,
    customerConcentrationTop20,
    customerConcentrationTop50,
    repeatRate,
    monthlyTrend,
  };
}

export const KPIS_UK = buildKpis("UK");
export const KPIS_US = buildKpis("US");

export function kpisByRegion(region: "UK" | "US"): RegionKpis {
  return region === "UK" ? KPIS_UK : KPIS_US;
}
