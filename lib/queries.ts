// Data access layer. Today: in-memory filter over generated company data.
// Future: replace these function bodies with SQL against Neon. The page-level
// API does not change.

import { COMPANIES_UK, COMPANIES_US, type Company } from "./mock-data/companies";
import type { TargetCriteria, Range } from "./criteria-types";

function inRange(value: number | null | undefined, range: Range | undefined): boolean {
  if (!range) return true;
  if (value === null || value === undefined) return false;
  return value >= range.min && value <= range.max;
}

function inSet<T>(value: T, values: T[]): boolean {
  return values.length === 0 || values.includes(value);
}

export function filterCompanies(criteria: TargetCriteria): Company[] {
  const sources: Company[] = (() => {
    if (criteria.region === "UK") return COMPANIES_UK;
    if (criteria.region === "US") return COMPANIES_US;
    return [...COMPANIES_UK, ...COMPANIES_US];
  })();

  return sources.filter((c) => {
    if (!inRange(c.lifetimeRevenue, criteria.lifetimeRevenue)) return false;
    if (!inRange(c.ltmRevenue, criteria.ltmRevenue)) return false;
    if (!inRange(c.l90dRevenue, criteria.l90dRevenue)) return false;
    if (!inRange(c.prior90dRevenue, criteria.prior90dRevenue)) return false;
    if (!inRange(c.daysSinceLastOrder, criteria.daysSinceLastOrder)) return false;
    if (!inRange(c.personalCadenceDays, criteria.personalCadenceDays)) return false;
    if (!inRange(c.lapseRatio, criteria.lapseRatio)) return false;
    if (!inRange(c.healthScore, criteria.healthScore)) return false;
    if (!inRange(c.lifetimeOrders, criteria.lifetimeOrders)) return false;
    if (!inRange(c.emailOpensL60d, criteria.emailOpensL60d)) return false;
    if (!inRange(c.activeContacts, criteria.activeContacts)) return false;

    if (!inSet(c.industry, criteria.industries)) return false;
    if (!inSet(c.sizeBand, criteria.sizeBands)) return false;
    if (!inSet(c.rfmSegment, criteria.rfmSegments)) return false;
    if (!inSet(c.healthBand, criteria.healthBands)) return false;
    if (criteria.owners.length > 0 && !criteria.owners.includes(c.ownerName)) return false;

    if (criteria.whaleFlag !== undefined && c.whaleFlag !== criteria.whaleFlag) return false;
    if (criteria.buyerIntentActive !== undefined && c.buyerIntentActive !== criteria.buyerIntentActive) return false;

    return true;
  });
}

// Range bounds derived from the actual data — used to size sliders dynamically.
export type FieldRange = { min: number; max: number; step: number };

export function fieldRanges(region: TargetCriteria["region"]): Record<string, FieldRange> {
  const sources =
    region === "UK" ? COMPANIES_UK :
    region === "US" ? COMPANIES_US :
    [...COMPANIES_UK, ...COMPANIES_US];

  const minMax = (vals: number[]): FieldRange => {
    const filtered = vals.filter((v) => Number.isFinite(v));
    if (filtered.length === 0) return { min: 0, max: 0, step: 1 };
    const min = Math.min(...filtered);
    const max = Math.max(...filtered);
    const span = max - min;
    let step = 1;
    if (span >= 100_000) step = 1000;
    else if (span >= 10_000) step = 100;
    else if (span >= 1000) step = 10;
    else if (span >= 50) step = 1;
    else step = 0.1;
    return { min, max, step };
  };

  return {
    lifetimeRevenue: minMax(sources.map((c) => c.lifetimeRevenue)),
    ltmRevenue: minMax(sources.map((c) => c.ltmRevenue)),
    l90dRevenue: minMax(sources.map((c) => c.l90dRevenue)),
    prior90dRevenue: minMax(sources.map((c) => c.prior90dRevenue)),
    daysSinceLastOrder: minMax(sources.map((c) => c.daysSinceLastOrder)),
    personalCadenceDays: minMax(sources.map((c) => c.personalCadenceDays ?? 0).filter((v) => v > 0)),
    lapseRatio: { ...minMax(sources.map((c) => c.lapseRatio)), step: 0.1 },
    healthScore: { ...minMax(sources.map((c) => c.healthScore)), step: 1 },
    lifetimeOrders: minMax(sources.map((c) => c.lifetimeOrders)),
    emailOpensL60d: minMax(sources.map((c) => c.emailOpensL60d)),
    activeContacts: minMax(sources.map((c) => c.activeContacts)),
  };
}

export function distinctOwners(region: TargetCriteria["region"]): string[] {
  const sources =
    region === "UK" ? COMPANIES_UK :
    region === "US" ? COMPANIES_US :
    [...COMPANIES_UK, ...COMPANIES_US];
  return Array.from(new Set(sources.map((c) => c.ownerName))).sort();
}
