import { COMPANIES_UK, COMPANIES_US, type Company } from "./companies";

export type Segment =
  | "Whales" | "Lapsed" | "Slipping" | "Ideal" | "Prospects"
  | "ReadyForReorder" | "Hibernating" | "New" | "Winback" | "CrossSell";

export type SegmentMembership = {
  region: "UK" | "US";
  segment: Segment;
  companyIds: string[];
  count: number;
  totalRevenueLtm: number;
  description: string;
  recommendedAction: string;
  actionOwner: "Marketing" | "AE" | "Hybrid";
};

const SEGMENT_DEFINITIONS: Record<Segment, { description: string; recommendedAction: string; actionOwner: "Marketing" | "AE" | "Hybrid" }> = {
  Whales: {
    description: "Top 50 accounts by LTM revenue — disproportionate share of total.",
    recommendedAction: "Quarterly AE business review, watch health score weekly.",
    actionOwner: "AE",
  },
  Lapsed: {
    description: "Accounts >2× their personal cadence past expected reorder date.",
    recommendedAction: "5-step reactivation email sequence + AE call after step 3.",
    actionOwner: "Hybrid",
  },
  Slipping: {
    description: "Accounts 1.0–2.0× past their cadence — early warning band.",
    recommendedAction: "Auto-trigger reorder reminder email; AE phone if whale.",
    actionOwner: "Hybrid",
  },
  Ideal: {
    description: "High health, regular cadence, growing basket — your blueprint accounts.",
    recommendedAction: "Light-touch nurture; cross-sell when peer-basket lift detected.",
    actionOwner: "Marketing",
  },
  Prospects: {
    description: "Marketing-qualified leads showing intent but no order history.",
    recommendedAction: "AE outreach with industry case study.",
    actionOwner: "AE",
  },
  ReadyForReorder: {
    description: "Predicted reorder date within next 14 days; not yet ordered.",
    recommendedAction: "Personalised reminder featuring last reordered SKUs.",
    actionOwner: "Marketing",
  },
  Hibernating: {
    description: "No order in 18+ months; low engagement; small historical value.",
    recommendedAction: "Annual win-back campaign; otherwise leave to age out.",
    actionOwner: "Marketing",
  },
  New: {
    description: "First order in last 90 days — protect onboarding window.",
    recommendedAction: "Onboarding sequence + AE introduction call.",
    actionOwner: "Hybrid",
  },
  Winback: {
    description: "Lapsed accounts showing fresh buyer intent (returning to site, opens).",
    recommendedAction: "Same-day AE call; tailored offer if whale.",
    actionOwner: "AE",
  },
  CrossSell: {
    description: "Active accounts with whitespace SKUs frequently bought by peers.",
    recommendedAction: "AE pitches the top peer-basket SKU with case study.",
    actionOwner: "AE",
  },
};

function classifyCompany(c: Company): Segment[] {
  const out: Segment[] = [];
  if (c.whaleFlag) out.push("Whales");
  if (c.lapseRatio >= 2.0) out.push("Lapsed");
  if (c.lapseRatio >= 1.0 && c.lapseRatio < 2.0) out.push("Slipping");
  if (c.healthBand === "green" && c.lifetimeOrders >= 6 && c.lapseRatio < 0.9) out.push("Ideal");
  if (c.lifetimeOrders <= 2 && c.daysSinceLastOrder <= 90) out.push("New");
  if (c.lapseRatio >= 0.85 && c.lapseRatio <= 1.15 && c.healthBand !== "red") out.push("ReadyForReorder");
  if (c.lapseRatio > 3.0 && c.lifetimeRevenue < 5000) out.push("Hibernating");
  if (c.lapseRatio >= 1.5 && c.buyerIntentActive) out.push("Winback");
  if (c.healthBand !== "red" && c.lifetimeOrders >= 5 && c.lapseRatio < 1.5) out.push("CrossSell");
  return out;
}

function buildSegmentsForRegion(region: "UK" | "US"): SegmentMembership[] {
  const companies = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  const buckets: Record<Segment, Company[]> = {
    Whales: [], Lapsed: [], Slipping: [], Ideal: [], Prospects: [],
    ReadyForReorder: [], Hibernating: [], New: [], Winback: [], CrossSell: [],
  };
  for (const c of companies) {
    for (const seg of classifyCompany(c)) buckets[seg].push(c);
  }

  // Prospects synthesised — small fixed count of "MQL" ghost accounts.
  // We'll fake their count and revenue but not full company records.
  const prospectCount = region === "UK" ? 84 : 41;

  const result: SegmentMembership[] = (Object.keys(buckets) as Segment[]).map((segment) => {
    if (segment === "Prospects") {
      return {
        region, segment,
        companyIds: [],
        count: prospectCount,
        totalRevenueLtm: 0,
        ...SEGMENT_DEFINITIONS[segment],
      };
    }
    const cs = buckets[segment];
    return {
      region, segment,
      companyIds: cs.map((c) => c.id),
      count: cs.length,
      totalRevenueLtm: cs.reduce((s, c) => s + c.ltmRevenue, 0),
      ...SEGMENT_DEFINITIONS[segment],
    };
  });

  return result;
}

export const SEGMENTS_UK = buildSegmentsForRegion("UK");
export const SEGMENTS_US = buildSegmentsForRegion("US");

export function segmentsByRegion(region: "UK" | "US"): SegmentMembership[] {
  return region === "UK" ? SEGMENTS_UK : SEGMENTS_US;
}

export function getSegment(region: "UK" | "US", segment: Segment): SegmentMembership {
  const list = segmentsByRegion(region);
  const found = list.find((s) => s.segment === segment);
  if (!found) throw new Error(`segment not found: ${segment}`);
  return found;
}

export const SEGMENT_INFO = SEGMENT_DEFINITIONS;
