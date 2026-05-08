import "server-only";

import { COMPANIES_UK, COMPANIES_US, type Company } from "@/lib/mock-data/companies";
import { kpisByRegion as mockKpisByRegion } from "@/lib/mock-data/kpis";
import { segmentsByRegion as mockSegmentsByRegion } from "@/lib/mock-data/segments";
import {
  insightsByRegion as mockInsightsByRegion,
  insightOf as mockInsightOf,
} from "@/lib/mock-data/insights";
import { generateOrdersFor } from "@/lib/mock-data/orders";
import type { TargetCriteria, Range } from "@/lib/criteria-types";
import type { DataLayer, FieldRange, Region } from "../contracts";

function inRange(value: number | null | undefined, range: Range | undefined): boolean {
  if (!range) return true;
  if (value === null || value === undefined) return false;
  return value >= range.min && value <= range.max;
}

function inSet<T>(value: T, values: T[]): boolean {
  return values.length === 0 || values.includes(value);
}

function sourcesFor(region: TargetCriteria["region"]): Company[] {
  if (region === "UK") return COMPANIES_UK;
  if (region === "US") return COMPANIES_US;
  return [...COMPANIES_UK, ...COMPANIES_US];
}

function listForRegion(region: Region): Company[] {
  return region === "UK" ? COMPANIES_UK : COMPANIES_US;
}

function minMax(vals: number[]): FieldRange {
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
}

const memoryImpl: DataLayer = {
  async filterCompanies(criteria) {
    const sources = sourcesFor(criteria.region);
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

      if (criteria.nameContains && criteria.nameContains.trim().length > 0) {
        if (!c.name.toLowerCase().includes(criteria.nameContains.toLowerCase().trim())) return false;
      }
      if (criteria.rfmScoreR !== undefined && c.rfmScores.r !== criteria.rfmScoreR) return false;
      if (criteria.rfmScoreF !== undefined && c.rfmScores.f !== criteria.rfmScoreF) return false;

      return true;
    });
  },

  async topNByLtmRevenue(region, n) {
    const list = listForRegion(region);
    return [...list].sort((a, b) => b.ltmRevenue - a.ltmRevenue).slice(0, n);
  },

  async companyById(id) {
    return COMPANIES_UK.find((c) => c.id === id) ?? COMPANIES_US.find((c) => c.id === id);
  },

  async companyByName(name) {
    const q = name.toLowerCase().trim();
    if (!q) return undefined;
    for (const list of [COMPANIES_UK, COMPANIES_US]) {
      const exact = list.find((c) => c.name.toLowerCase() === q);
      if (exact) return exact;
    }
    for (const list of [COMPANIES_UK, COMPANIES_US]) {
      const prefix = list.find((c) => c.name.toLowerCase().startsWith(q));
      if (prefix) return prefix;
    }
    for (const list of [COMPANIES_UK, COMPANIES_US]) {
      const sub = list.find((c) => c.name.toLowerCase().includes(q));
      if (sub) return sub;
    }
    return undefined;
  },

  async companiesByRegion(region) {
    return listForRegion(region);
  },

  async kpisByRegion(region) {
    return mockKpisByRegion(region);
  },

  async segmentsByRegion(region) {
    return mockSegmentsByRegion(region);
  },

  async insightsByRegion(region) {
    return mockInsightsByRegion(region);
  },

  async insightOf(region, type) {
    return mockInsightOf(region, type);
  },

  async ordersForCompany(companyId) {
    const company = await this.companyById(companyId);
    if (!company) return [];
    return generateOrdersFor(company);
  },

  async fieldRanges(region) {
    const sources = sourcesFor(region);
    return {
      lifetimeRevenue: minMax(sources.map((c) => c.lifetimeRevenue)),
      ltmRevenue: minMax(sources.map((c) => c.ltmRevenue)),
      l90dRevenue: minMax(sources.map((c) => c.l90dRevenue)),
      prior90dRevenue: minMax(sources.map((c) => c.prior90dRevenue)),
      daysSinceLastOrder: minMax(sources.map((c) => c.daysSinceLastOrder)),
      personalCadenceDays: minMax(
        sources.map((c) => c.personalCadenceDays ?? 0).filter((v) => v > 0),
      ),
      lapseRatio: { ...minMax(sources.map((c) => c.lapseRatio)), step: 0.1 },
      healthScore: { ...minMax(sources.map((c) => c.healthScore)), step: 1 },
      lifetimeOrders: minMax(sources.map((c) => c.lifetimeOrders)),
      emailOpensL60d: minMax(sources.map((c) => c.emailOpensL60d)),
      activeContacts: minMax(sources.map((c) => c.activeContacts)),
    };
  },

  async distinctOwners(region) {
    const sources = sourcesFor(region);
    return Array.from(new Set(sources.map((c) => c.ownerName))).sort();
  },

  async nameToIdMap(region) {
    const list = listForRegion(region);
    const map: Record<string, string> = {};
    for (const c of list) {
      map[c.name.toLowerCase()] = c.id;
    }
    return map;
  },

  async lapsedByRegion(region, limit) {
    const list = listForRegion(region);
    const lapsed = list
      .filter((c) => c.lapseRatio >= 1.5)
      .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);
    return typeof limit === "number" ? lapsed.slice(0, limit) : lapsed;
  },

  async intentBackByRegion(region, limit) {
    const list = listForRegion(region);
    const intent = list
      .filter((c) => c.buyerIntentActive && c.lapseRatio >= 1.2)
      .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);
    return typeof limit === "number" ? intent.slice(0, limit) : intent;
  },
};

export default memoryImpl;
