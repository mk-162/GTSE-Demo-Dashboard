// Filter criteria for the Targets page. Today these are run in-memory over
// generated company data (lib/queries.ts). When we cut to Neon Postgres these
// fields become WHERE clauses; the page never knows the difference.

import type { HealthBand, RfmSegment, SizeBand } from "./mock-data/companies";
import type { Industry } from "./mock-data/name-banks";

export type Range = { min: number; max: number };

export type TargetCriteria = {
  // Region scope. "All" = both UK and US.
  region: "UK" | "US" | "All";

  // Numeric ranges — each key is a tuple [min, max]. null/undefined = no filter on that field.
  lifetimeRevenue?: Range;
  ltmRevenue?: Range;
  l90dRevenue?: Range;
  prior90dRevenue?: Range;
  daysSinceLastOrder?: Range;
  personalCadenceDays?: Range;
  lapseRatio?: Range;
  healthScore?: Range;
  lifetimeOrders?: Range;
  emailOpensL60d?: Range;
  activeContacts?: Range;

  // Categorical filters — empty array means "no filter on this field".
  industries: Industry[];
  sizeBands: SizeBand[];
  rfmSegments: RfmSegment[];
  healthBands: HealthBand[];
  owners: string[];

  // Boolean flags — undefined = no filter
  whaleFlag?: boolean;
  buyerIntentActive?: boolean;
};

export const EMPTY_CRITERIA: TargetCriteria = {
  region: "UK",
  industries: [],
  sizeBands: [],
  rfmSegments: [],
  healthBands: [],
  owners: [],
};

// Pre-built target templates — one click loads these criteria into the builder.
export type TargetTemplate = {
  id: string;
  name: string;
  description: string;
  criteria: Partial<TargetCriteria>;
};

export const TEMPLATES: TargetTemplate[] = [
  {
    id: "former-whales",
    name: "Was a whale, now isn't",
    description: "Lifetime revenue ≥ £50k, but LTM revenue < £5k — protect/reactivate.",
    criteria: {
      lifetimeRevenue: { min: 50_000, max: 5_000_000 },
      ltmRevenue: { min: 0, max: 5_000 },
    },
  },
  {
    id: "past-cadence",
    name: "Past their reorder cadence",
    description: "Lapse ratio ≥ 1.5 — overdue compared to their personal rhythm.",
    criteria: {
      lapseRatio: { min: 1.5, max: 10 },
      lifetimeOrders: { min: 3, max: 200 },
    },
  },
  {
    id: "intent-back",
    name: "Lapsed but back on the website",
    description: "Lapsed accounts with active buyer intent — same-day call worthy.",
    criteria: {
      lapseRatio: { min: 1.5, max: 10 },
      buyerIntentActive: true,
    },
  },
  {
    id: "high-value-amber-red",
    name: "High-value accounts in amber/red",
    description: "LTM ≥ £20k and health < 70 — at-risk revenue.",
    criteria: {
      ltmRevenue: { min: 20_000, max: 5_000_000 },
      healthBands: ["amber", "red"],
    },
  },
  {
    id: "ready-for-reorder",
    name: "Ready for their next order",
    description: "Healthy accounts within 1× of their cadence — perfect timing for a nudge.",
    criteria: {
      lapseRatio: { min: 0.85, max: 1.15 },
      healthBands: ["green", "amber"],
      lifetimeOrders: { min: 4, max: 200 },
    },
  },
  {
    id: "dormant-cleanup",
    name: "Dormant low-value cleanup",
    description: "No order in 18+ months and lifetime revenue under £2k — annual win-back or age out.",
    criteria: {
      daysSinceLastOrder: { min: 540, max: 5000 },
      lifetimeRevenue: { min: 0, max: 2_000 },
    },
  },
  {
    id: "no-cross-sell",
    name: "Active accounts under-buying",
    description: "Healthy frequent buyers with low LTM — basket-size growth opportunity.",
    criteria: {
      lifetimeOrders: { min: 6, max: 200 },
      healthBands: ["green"],
      ltmRevenue: { min: 0, max: 8_000 },
    },
  },
];
