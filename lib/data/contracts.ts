import "server-only";

import type { Company, HealthBand, RfmSegment, SizeBand } from "@/lib/mock-data/companies";
import type { Industry } from "@/lib/mock-data/name-banks";
import type { RegionKpis } from "@/lib/mock-data/kpis";
import type { SegmentMembership, Segment } from "@/lib/mock-data/segments";
import type { Insight, InsightType } from "@/lib/mock-data/insights";
import type { Order, OrderLine } from "@/lib/mock-data/orders";
import type { Sku } from "@/lib/mock-data/skus";
import type { TargetCriteria, Range } from "@/lib/criteria-types";

export type Region = "UK" | "US";

export type FieldRange = { min: number; max: number; step: number };

export type {
  Company,
  HealthBand,
  RfmSegment,
  SizeBand,
  Industry,
  RegionKpis,
  SegmentMembership,
  Segment,
  Insight,
  InsightType,
  Order,
  OrderLine,
  Sku,
  TargetCriteria,
  Range,
};

export interface DataLayer {
  filterCompanies(criteria: TargetCriteria): Promise<Company[]>;
  topNByLtmRevenue(region: Region, n: number): Promise<Company[]>;
  companyById(id: string): Promise<Company | undefined>;
  companyByName(name: string): Promise<Company | undefined>;
  companiesByRegion(region: Region): Promise<Company[]>;
  kpisByRegion(region: Region): Promise<RegionKpis>;
  segmentsByRegion(region: Region): Promise<SegmentMembership[]>;
  insightsByRegion(region: Region): Promise<Insight[]>;
  insightOf(region: Region, type: InsightType): Promise<Insight | undefined>;
  ordersForCompany(companyId: string): Promise<Order[]>;
  fieldRanges(region: TargetCriteria["region"]): Promise<Record<string, FieldRange>>;
  distinctOwners(region: TargetCriteria["region"]): Promise<string[]>;
  nameToIdMap(region: Region): Promise<Record<string, string>>;
  lapsedByRegion(region: Region, limit?: number): Promise<Company[]>;
  intentBackByRegion(region: Region, limit?: number): Promise<Company[]>;
}
