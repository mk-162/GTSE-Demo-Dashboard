import { createRng, intBetween, pick, pickWeighted, paretoRevenue, gaussian, type Rng } from "./rng";
import {
  UK_TOWNS, US_CITIES, UK_SECTORS, US_SECTORS, UK_SUFFIXES, US_SUFFIXES,
  UK_COUNTIES, US_STATES, UK_AE_NAMES, US_AE_NAMES, INDUSTRIES,
  NAMED_UK_WHALES, NAMED_US_WHALES, type Industry,
} from "./name-banks";
import { SKUS } from "./skus";

export type SizeBand = "micro" | "small" | "mid" | "large";
export type RfmSegment = "Champion" | "Loyal" | "AtRisk" | "CannotLose" | "Hibernating" | "New" | "Promising";
export type HealthBand = "green" | "amber" | "red";

export type Company = {
  id: string;
  name: string;
  region: "UK" | "US";
  industry: Industry;
  sizeBand: SizeBand;
  region_subdiv: string;
  ownerName: string;
  firstOrderDate: string;
  lastOrderDate: string;
  lifetimeOrders: number;
  lifetimeRevenue: number;
  ltmRevenue: number;
  l90dRevenue: number;
  prior90dRevenue: number;
  personalCadenceDays: number | null;
  daysSinceLastOrder: number;
  predictedNextOrderDate: string;
  lapseRatio: number;
  rfmSegment: RfmSegment;
  rfmScores: { r: 1 | 2 | 3 | 4 | 5; f: 1 | 2 | 3 | 4 | 5; m: 1 | 2 | 3 | 4 | 5 };
  healthScore: number;
  healthBand: HealthBand;
  whaleFlag: boolean;
  concentrationPctL90d: number;
  top3ReorderSkus: string[];
  top3CrossSellSkus: string[];
  buyerIntentActive: boolean;
  lastEngagementDate: string;
  daysSinceLastEngagement: number;
  emailOpensL60d: number;
  activeContacts: number;
};

const TODAY = new Date("2026-05-07");
const TODAY_ISO = TODAY.toISOString().slice(0, 10);

function isoDateOffset(daysAgo: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function isoDateFuture(daysAhead: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function generateUkName(rng: Rng): string {
  const town = pick(rng, UK_TOWNS);
  const sector = pick(rng, UK_SECTORS);
  const suffix = pick(rng, UK_SUFFIXES);
  return `${town} ${sector} ${suffix}`;
}

function generateUsName(rng: Rng): string {
  const city = pick(rng, US_CITIES);
  const sector = pick(rng, US_SECTORS);
  const suffix = pick(rng, US_SUFFIXES);
  return `${city} ${sector} ${suffix}`;
}

function rfmScoreFromCadence(daysSinceLast: number, lifetimeOrders: number, ltmRevenue: number): {
  r: 1 | 2 | 3 | 4 | 5; f: 1 | 2 | 3 | 4 | 5; m: 1 | 2 | 3 | 4 | 5;
} {
  let r: 1 | 2 | 3 | 4 | 5;
  if (daysSinceLast <= 30) r = 5;
  else if (daysSinceLast <= 60) r = 4;
  else if (daysSinceLast <= 120) r = 3;
  else if (daysSinceLast <= 240) r = 2;
  else r = 1;

  let f: 1 | 2 | 3 | 4 | 5;
  if (lifetimeOrders >= 50) f = 5;
  else if (lifetimeOrders >= 24) f = 4;
  else if (lifetimeOrders >= 12) f = 3;
  else if (lifetimeOrders >= 4) f = 2;
  else f = 1;

  let m: 1 | 2 | 3 | 4 | 5;
  if (ltmRevenue >= 50000) m = 5;
  else if (ltmRevenue >= 20000) m = 4;
  else if (ltmRevenue >= 8000) m = 3;
  else if (ltmRevenue >= 2500) m = 2;
  else m = 1;

  return { r, f, m };
}

function rfmSegmentFromScores(r: number, f: number, m: number): RfmSegment {
  if (r >= 4 && f >= 4 && m >= 4) return "Champion";
  if (r >= 4 && f >= 3) return "Loyal";
  if (r >= 4 && f <= 2) return "Promising";
  if (r <= 2 && f >= 4 && m >= 4) return "CannotLose";
  if (r <= 2 && f >= 3) return "AtRisk";
  if (r <= 2 && f <= 2) return "Hibernating";
  if (r >= 4 && f <= 1) return "New";
  return "Loyal";
}

function pickIndustry(rng: Rng): Industry {
  return pick(rng, INDUSTRIES);
}

function chooseTop3Reorder(rng: Rng, industry: Industry, sizeBand: SizeBand): string[] {
  // Bias SKUs by industry — pull from real GTSE catalogue.
  const byCategory = (cats: string[]) => SKUS.filter((s) => cats.includes(s.category)).map((s) => s.code);

  const candidates: string[] = [];

  // Industry → which sign categories they buy most
  const map: Record<string, string[]> = {
    "Construction": ["Construction Signs", "Warning Signs", "Multi-Message Signs", "Mandatory Signs"],
    "Highway Maintenance": ["Road Signs", "Construction Signs", "Floor Graphics"],
    "Manufacturing": ["Mandatory Signs", "Warning Signs", "5S/6S", "Warehouse Labelling and Marking"],
    "Engineering Services": ["Mandatory Signs", "Warning Signs", "Hazard Signs"],
    "Logistics & Warehousing": ["Warehouse Labelling and Marking", "Floor Graphics", "Mandatory Signs", "Vehicle Marking Signs"],
    "Facilities Management": ["Janitorial & Environmental", "Information Signs", "Mandatory Signs"],
    "Rail": ["Construction Signs", "Hazard Signs", "Warning Signs"],
    "Utilities": ["Hazard Signs", "Warning Signs", "Photoluminescent"],
    "Oil & Gas": ["Hazard Signs", "Photoluminescent", "Fire Signs"],
    "Mining": ["Hazard Signs", "Warning Signs", "Mandatory Signs"],
    "Food Processing": ["Janitorial & Environmental", "Mandatory Signs", "First Aid & Safe Condition Signs"],
    "Pharmaceutical Manufacturing": ["Mandatory Signs", "Hazard Signs", "First Aid & Safe Condition Signs"],
    "Automotive": ["5S/6S", "Floor Graphics", "Mandatory Signs"],
    "Aerospace": ["5S/6S", "Mandatory Signs", "Hazard Signs"],
    "Marine": ["Mandatory Signs", "Photoluminescent", "Warning Signs"],
    "Public Sector / Local Authority": ["Information Signs", "Prohibition Signs", "First Aid & Safe Condition Signs"],
    "Education (FE/HE)": ["Information Signs", "Prohibition Signs", "Photoluminescent"],
    "Healthcare Estates": ["First Aid & Safe Condition Signs", "Mandatory Signs", "Photoluminescent"],
  };
  const cats = map[industry] ?? ["Warning Signs", "Mandatory Signs", "Information Signs"];
  candidates.push(...byCategory(cats));

  // Large accounts also reorder bulk packs
  if (sizeBand === "large" || sizeBand === "mid") {
    candidates.push(...byCategory(["Bulk Packs"]));
  }

  // Fallback
  while (candidates.length < 6) candidates.push(pick(rng, SKUS).code);

  // Pick 3 distinct, weighted to first half (most-relevant)
  const seen = new Set<string>();
  const out: string[] = [];
  while (out.length < 3 && candidates.length > 0) {
    const idx = Math.floor(rng() * candidates.length * 0.7); // bias to top
    const code = candidates[idx];
    candidates.splice(idx, 1);
    if (!seen.has(code)) { seen.add(code); out.push(code); }
  }
  return out;
}

function chooseCrossSell(rng: Rng, alreadyOrdered: string[]): string[] {
  const out: string[] = [];
  const seen = new Set(alreadyOrdered);
  while (out.length < 3) {
    const sku = pick(rng, SKUS).code;
    if (!seen.has(sku)) { seen.add(sku); out.push(sku); }
  }
  return out;
}

type CompanySeed = {
  isNamedWhale: boolean;
  storyArc?: "slipping" | "lapsed_former_whale" | "champion" | "buyer_intent_back" | "ideal";
  forcedName?: string;
  forcedIndustry?: Industry;
  forcedSubdiv?: string;
};

function generateCompanies(region: "UK" | "US", count: number, seed: number): Company[] {
  const rng = createRng(seed);
  const aeNames = region === "UK" ? UK_AE_NAMES : US_AE_NAMES;
  const subdivs = region === "UK" ? UK_COUNTIES : US_STATES;
  const namedWhales = region === "UK" ? NAMED_UK_WHALES : NAMED_US_WHALES;

  const seeds: CompanySeed[] = [];

  // Named whales: each has a defined story arc that maps to the AI insight prose.
  // UK arcs (matching name-banks order: Sheffield, Birmingham, Manchester, Glasgow,
  // Newcastle, Cardiff, Bristol, Leeds, Edinburgh, Norfolk).
  // US arcs (matching: Houston, Detroit, Seattle, Chicago, Phoenix, Atlanta, Boston,
  // Denver, Miami, Portland).
  const ukArcs: ("slipping" | "lapsed_former_whale" | "champion" | "buyer_intent_back" | "ideal")[] = [
    "slipping",            // Sheffield — 60% drop in 90d
    "lapsed_former_whale", // Birmingham — 6 months silent
    "slipping",            // Manchester — 8 days overdue monthly
    "lapsed_former_whale", // Glasgow — 5 months silent
    "buyer_intent_back",   // Newcastle — 8 months silent, intent now active
    "slipping",            // Cardiff — basket shrink
    "lapsed_former_whale", // Bristol — 7 months silent, turned amber today
    "lapsed_former_whale", // Leeds — 9 months silent
    "ideal",               // Edinburgh — solid, cross-sell opp
    "champion",            // Norfolk — steady champion
  ];
  const usArcs: ("slipping" | "lapsed_former_whale" | "champion" | "buyer_intent_back" | "ideal")[] = [
    "champion",            // Houston — anchor account, basket growing
    "slipping",            // Detroit — slipping, AE silence
    "champion",            // Seattle — strong
    "slipping",            // Chicago — overdue on quarterly
    "slipping",            // Phoenix — slipping
    "lapsed_former_whale", // Atlanta — 9 months, highest historical AOV
    "buyer_intent_back",   // Boston — 7 months silent, returning to site
    "champion",            // Denver — steady
    "lapsed_former_whale", // Miami — 6 months silent
    "lapsed_former_whale", // Portland — 5 months silent
  ];
  const arcs = region === "UK" ? ukArcs : usArcs;

  namedWhales.forEach((nw, i) => {
    seeds.push({
      isNamedWhale: true,
      storyArc: arcs[i % arcs.length],
      forcedName: nw.name,
      forcedIndustry: nw.industry as Industry,
      forcedSubdiv: nw.region_subdiv,
    });
  });

  while (seeds.length < count) {
    seeds.push({ isNamedWhale: false });
  }

  const companies: Company[] = [];

  // Build revenue Pareto rank: assign approx revenue ranks first so top-50 = ~70% of total
  // Use index-based bucketing
  const ranks = Array.from({ length: count }, (_, i) => i);

  for (let idx = 0; idx < count; idx++) {
    const cs = seeds[idx];
    const rank = ranks[idx]; // 0 = highest revenue rank
    const isTop10 = rank < 10;
    const isTop50 = rank < 50;

    const id = `co_${region.toLowerCase()}_${String(idx + 1).padStart(4, "0")}`;
    const name = cs.forcedName ?? (region === "UK" ? generateUkName(rng) : generateUsName(rng));
    const industry = cs.forcedIndustry ?? pickIndustry(rng);
    const region_subdiv = cs.forcedSubdiv ?? pick(rng, subdivs);
    const ownerName = pick(rng, aeNames);

    // Size band correlated with rank
    let sizeBand: SizeBand;
    if (rank < 50) sizeBand = "large";
    else if (rank < 250) sizeBand = "mid";
    else if (rank < 1500) sizeBand = "small";
    else sizeBand = "micro";

    // LTM revenue from a Pareto-shaped distribution.
    // Banding (rank-based) tuned for ~5,000 UK / 3,000 US accounts.
    let ltmBase: number;
    if (rank < 5) ltmBase = paretoRevenue(rng, 90000, 240000, 1.4);
    else if (rank < 20) ltmBase = paretoRevenue(rng, 35000, 90000, 1.6);
    else if (rank < 50) ltmBase = paretoRevenue(rng, 12000, 38000, 1.8);
    else if (rank < 200) ltmBase = paretoRevenue(rng, 4000, 14000, 2.0);
    else if (rank < 800) ltmBase = paretoRevenue(rng, 1200, 4500, 2.2);
    else if (rank < 2500) ltmBase = paretoRevenue(rng, 250, 1500, 2.4);
    else ltmBase = paretoRevenue(rng, 60, 350, 2.6);

    let ltmRevenue = ltmBase;

    // Story arc adjustments — shrink revenue for slipping, near-zero for lapsed
    if (cs.storyArc === "slipping") ltmRevenue = ltmBase * 0.55;
    if (cs.storyArc === "lapsed_former_whale") ltmRevenue = ltmBase * 0.20;

    // Cadence buckets
    // 30% monthly, 30% quarterly, 25% twice-a-year, 15% less frequent
    const cadenceBucket = pickWeighted(rng, [
      { value: 30, weight: 30 },
      { value: 90, weight: 30 },
      { value: 180, weight: 25 },
      { value: 365, weight: 15 },
    ]);
    const cadenceJitter = gaussian(rng, 0, cadenceBucket * 0.15);
    const personalCadenceDays = Math.max(14, Math.round(cadenceBucket + cadenceJitter));

    // Lifetime orders correlated with cadence and tenure
    const tenureYears = (rank < 50 ? gaussian(rng, 6, 2) : gaussian(rng, 3, 1.5));
    const tenureClamped = Math.max(0.5, Math.min(15, tenureYears));
    const ordersPerYear = 365 / personalCadenceDays;
    let lifetimeOrders = Math.max(1, Math.round(ordersPerYear * tenureClamped));
    if (lifetimeOrders > 200) lifetimeOrders = 200;

    // Force top whales to have meaty lifetime orders
    if (rank < 10 && lifetimeOrders < 30) lifetimeOrders = intBetween(rng, 30, 80);

    // Days since last order
    let lapseRatio: number;
    let daysSinceLastOrder: number;

    if (cs.storyArc === "slipping") {
      // 1.5x - 2.5x cadence
      lapseRatio = 1.5 + rng() * 1.0;
      daysSinceLastOrder = Math.round(personalCadenceDays * lapseRatio);
    } else if (cs.storyArc === "lapsed_former_whale") {
      lapseRatio = 2.5 + rng() * 2.0;
      daysSinceLastOrder = Math.round(personalCadenceDays * lapseRatio);
    } else if (cs.storyArc === "champion" || cs.storyArc === "ideal") {
      lapseRatio = 0.4 + rng() * 0.6;
      daysSinceLastOrder = Math.round(personalCadenceDays * lapseRatio);
    } else if (cs.storyArc === "buyer_intent_back") {
      lapseRatio = 1.4 + rng() * 0.4;
      daysSinceLastOrder = Math.round(personalCadenceDays * lapseRatio);
    } else {
      // ~20% of remainder are clearly lapsed (>1.5)
      const lapsedRoll = rng();
      if (lapsedRoll < 0.20) {
        lapseRatio = 1.5 + rng() * 2.5;
      } else if (lapsedRoll < 0.45) {
        // Slipping-ish 1.0-1.5
        lapseRatio = 1.0 + rng() * 0.5;
      } else {
        // Healthy 0.2-1.0
        lapseRatio = 0.2 + rng() * 0.8;
      }
      daysSinceLastOrder = Math.round(personalCadenceDays * lapseRatio);
    }

    // Cap days since last order at 800 to keep dates plausible
    daysSinceLastOrder = Math.min(daysSinceLastOrder, 800);
    const lastOrderDate = isoDateOffset(daysSinceLastOrder);
    const firstOrderDate = isoDateOffset(Math.round(tenureClamped * 365));

    // Predicted next order = last order + cadence
    const predictedNextOrderDate = (() => {
      const d = new Date(lastOrderDate);
      d.setDate(d.getDate() + personalCadenceDays);
      return d.toISOString().slice(0, 10);
    })();

    // Lifetime revenue ~ ltm * tenure factor (older accounts)
    const tenureFactor = Math.max(1, tenureClamped * 0.85);
    const lifetimeRevenue = Math.round(ltmRevenue * tenureFactor + gaussian(rng, 0, ltmRevenue * 0.1));

    // L90d / prior 90d — slightly down for slipping, near zero for lapsed
    let l90dRevenue: number;
    let prior90dRevenue: number;
    if (cs.storyArc === "slipping") {
      l90dRevenue = ltmRevenue * 0.10;
      prior90dRevenue = ltmRevenue * 0.30;
    } else if (cs.storyArc === "lapsed_former_whale") {
      l90dRevenue = 0;
      prior90dRevenue = ltmRevenue * 0.15;
    } else if (lapseRatio < 1.0) {
      const share = 0.20 + rng() * 0.10;
      l90dRevenue = ltmRevenue * share;
      prior90dRevenue = ltmRevenue * (share - 0.02);
    } else {
      l90dRevenue = ltmRevenue * (0.05 + rng() * 0.15);
      prior90dRevenue = ltmRevenue * (0.20 + rng() * 0.10);
    }
    l90dRevenue = Math.max(0, Math.round(l90dRevenue));
    prior90dRevenue = Math.max(0, Math.round(prior90dRevenue));
    ltmRevenue = Math.round(ltmRevenue);

    // Engagement
    let daysSinceLastEngagement: number;
    if (cs.storyArc === "slipping") daysSinceLastEngagement = intBetween(rng, 18, 28);
    else if (cs.storyArc === "lapsed_former_whale") daysSinceLastEngagement = intBetween(rng, 30, 90);
    else if (cs.storyArc === "champion" || cs.storyArc === "ideal") daysSinceLastEngagement = intBetween(rng, 1, 10);
    else daysSinceLastEngagement = intBetween(rng, 2, 60);

    const lastEngagementDate = isoDateOffset(daysSinceLastEngagement);

    let emailOpensL60d: number;
    if (cs.storyArc === "buyer_intent_back" || cs.storyArc === "champion") emailOpensL60d = intBetween(rng, 6, 18);
    else if (cs.storyArc === "lapsed_former_whale") emailOpensL60d = intBetween(rng, 0, 2);
    else emailOpensL60d = intBetween(rng, 0, 8);

    // Health score formula from spec
    const lapseTerm = Math.min(lapseRatio, 2.0) * 25;
    const engagementTerm = Math.min(daysSinceLastEngagement / 30, 2.0) * 15;
    const opensTerm = Math.min(emailOpensL60d, 5) * 4;
    let healthScore = 100 - lapseTerm - engagementTerm + opensTerm;
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    let healthBand: HealthBand;
    if (healthScore >= 70) healthBand = "green";
    else if (healthScore >= 40) healthBand = "amber";
    else healthBand = "red";

    // RFM
    const rfmScores = rfmScoreFromCadence(daysSinceLastOrder, lifetimeOrders, ltmRevenue);
    const rfmSegment = rfmSegmentFromScores(rfmScores.r, rfmScores.f, rfmScores.m);

    // Whale flag — top 50 by LTM in region (we're already revenue-ranked so use rank)
    const whaleFlag = isTop50;

    // Buyer intent ~10% of companies; biased to lapsed
    let buyerIntentActive = false;
    if (cs.storyArc === "buyer_intent_back") {
      buyerIntentActive = true;
    } else if (lapseRatio > 1.5) {
      buyerIntentActive = rng() < 0.18;
    } else {
      buyerIntentActive = rng() < 0.07;
    }

    const top3ReorderSkus = chooseTop3Reorder(rng, industry, sizeBand);
    const top3CrossSellSkus = chooseCrossSell(rng, top3ReorderSkus);

    const activeContacts = (() => {
      if (sizeBand === "large") return intBetween(rng, 4, 9);
      if (sizeBand === "mid") return intBetween(rng, 2, 5);
      if (sizeBand === "small") return intBetween(rng, 1, 3);
      return intBetween(rng, 1, 2);
    })();

    companies.push({
      id, name, region, industry, sizeBand, region_subdiv, ownerName,
      firstOrderDate, lastOrderDate, lifetimeOrders, lifetimeRevenue,
      ltmRevenue, l90dRevenue, prior90dRevenue,
      personalCadenceDays: lifetimeOrders >= 3 ? personalCadenceDays : null,
      daysSinceLastOrder, predictedNextOrderDate,
      lapseRatio: Math.round(lapseRatio * 100) / 100,
      rfmSegment, rfmScores,
      healthScore, healthBand, whaleFlag,
      concentrationPctL90d: 0, // computed after totals
      top3ReorderSkus, top3CrossSellSkus,
      buyerIntentActive, lastEngagementDate, daysSinceLastEngagement,
      emailOpensL60d, activeContacts,
    });
  }

  // Compute concentration pct
  const totalL90d = companies.reduce((s, c) => s + c.l90dRevenue, 0) || 1;
  for (const c of companies) {
    c.concentrationPctL90d = Math.round((c.l90dRevenue / totalL90d) * 1000) / 10;
  }

  // Sort by ltmRevenue desc so the rank/index mostly aligns
  companies.sort((a, b) => b.ltmRevenue - a.ltmRevenue);

  return companies;
}

export const COMPANIES_UK: Company[] = generateCompanies("UK", 5000, 13371);
export const COMPANIES_US: Company[] = generateCompanies("US", 3000, 28009);
export const ALL_COMPANIES: Company[] = [...COMPANIES_UK, ...COMPANIES_US];

export function companiesByRegion(region: "UK" | "US"): Company[] {
  return region === "UK" ? COMPANIES_UK : COMPANIES_US;
}

export const TODAY_DATE = TODAY_ISO;
export { isoDateOffset, isoDateFuture };
