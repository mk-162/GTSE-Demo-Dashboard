// URL <-> TargetCriteria codec. Used so any page can deep-link into the
// Target builder pre-filtered to a slice (segment, RFM cell, named whale, etc.).

import { EMPTY_CRITERIA, TEMPLATES, type TargetCriteria, type Range } from "./criteria-types";
import type { HealthBand, RfmSegment, SizeBand } from "./mock-data/companies";
import { INDUSTRIES, type Industry } from "./mock-data/name-banks";

const ALL_INDUSTRIES = new Set<string>(INDUSTRIES);
const ALL_SIZES: SizeBand[] = ["large", "mid", "small", "micro"];
const ALL_RFM: RfmSegment[] = ["Champion", "Loyal", "AtRisk", "CannotLose", "Hibernating", "New", "Promising"];
const ALL_HEALTH: HealthBand[] = ["green", "amber", "red"];

function csv(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function rangeFromParams(p: URLSearchParams, key: string): Range | undefined {
  const min = p.get(`${key}Min`);
  const max = p.get(`${key}Max`);
  if (min == null && max == null) return undefined;
  return {
    min: min != null ? Number(min) : -Infinity,
    max: max != null ? Number(max) : Infinity,
  };
}

function parseBool(v: string | null): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/** Read URL params and produce a TargetCriteria patch. */
export function paramsToCriteria(params: URLSearchParams): Partial<TargetCriteria> {
  const out: Partial<TargetCriteria> = {};

  // Template — overrides everything else, applied first.
  const tmpl = params.get("template");
  if (tmpl) {
    const found = TEMPLATES.find((t) => t.id === tmpl);
    if (found) Object.assign(out, found.criteria);
  }

  // Region scope
  const region = params.get("region");
  if (region === "UK" || region === "US" || region === "All") out.region = region;

  // Categorical multi-selects
  const ind = csv(params.get("industry")).filter((x) => ALL_INDUSTRIES.has(x)) as Industry[];
  if (ind.length) out.industries = ind;
  const size = csv(params.get("size")).filter((x) => ALL_SIZES.includes(x as SizeBand)) as SizeBand[];
  if (size.length) out.sizeBands = size;
  const rfm = csv(params.get("rfm")).filter((x) => ALL_RFM.includes(x as RfmSegment)) as RfmSegment[];
  if (rfm.length) out.rfmSegments = rfm;
  const health = csv(params.get("health")).filter((x) => ALL_HEALTH.includes(x as HealthBand)) as HealthBand[];
  if (health.length) out.healthBands = health;
  const owners = csv(params.get("owner"));
  if (owners.length) out.owners = owners;

  // Booleans
  const whale = parseBool(params.get("whale"));
  if (whale !== undefined) out.whaleFlag = whale;
  const intent = parseBool(params.get("intent"));
  if (intent !== undefined) out.buyerIntentActive = intent;

  // Free text + exact R/F
  const q = params.get("q");
  if (q) out.nameContains = q;
  const r = Number(params.get("r"));
  if (r >= 1 && r <= 5) out.rfmScoreR = r as 1 | 2 | 3 | 4 | 5;
  const f = Number(params.get("f"));
  if (f >= 1 && f <= 5) out.rfmScoreF = f as 1 | 2 | 3 | 4 | 5;

  // Ranges (lifetimeRevenue, ltmRevenue, l90dRevenue, prior90dRevenue,
  // daysSinceLastOrder, personalCadenceDays, lapseRatio, healthScore,
  // lifetimeOrders, emailOpensL60d, activeContacts)
  const ranges: (keyof TargetCriteria)[] = [
    "lifetimeRevenue", "ltmRevenue", "l90dRevenue", "prior90dRevenue",
    "daysSinceLastOrder", "personalCadenceDays", "lapseRatio", "healthScore",
    "lifetimeOrders", "emailOpensL60d", "activeContacts",
  ];
  for (const k of ranges) {
    const r = rangeFromParams(params, String(k));
    if (r) (out as Record<string, unknown>)[k as string] = r;
  }

  return out;
}

/** Merge a patch into the empty default criteria, preserving region. */
export function mergeCriteria(
  patch: Partial<TargetCriteria>,
  defaults: TargetCriteria = EMPTY_CRITERIA,
): TargetCriteria {
  return { ...defaults, ...patch };
}

/** Build a /targets URL from a partial criteria slice. */
export function targetsUrl(patch: Partial<TargetCriteria> & { template?: string }): string {
  const params = new URLSearchParams();
  if (patch.template) params.set("template", patch.template);
  if (patch.region) params.set("region", patch.region);
  if (patch.industries?.length) params.set("industry", patch.industries.join(","));
  if (patch.sizeBands?.length) params.set("size", patch.sizeBands.join(","));
  if (patch.rfmSegments?.length) params.set("rfm", patch.rfmSegments.join(","));
  if (patch.healthBands?.length) params.set("health", patch.healthBands.join(","));
  if (patch.owners?.length) params.set("owner", patch.owners.join(","));
  if (patch.whaleFlag !== undefined) params.set("whale", String(patch.whaleFlag));
  if (patch.buyerIntentActive !== undefined) params.set("intent", String(patch.buyerIntentActive));
  if (patch.nameContains) params.set("q", patch.nameContains);
  if (patch.rfmScoreR !== undefined) params.set("r", String(patch.rfmScoreR));
  if (patch.rfmScoreF !== undefined) params.set("f", String(patch.rfmScoreF));

  const ranges: (keyof TargetCriteria)[] = [
    "lifetimeRevenue", "ltmRevenue", "l90dRevenue", "prior90dRevenue",
    "daysSinceLastOrder", "personalCadenceDays", "lapseRatio", "healthScore",
    "lifetimeOrders", "emailOpensL60d", "activeContacts",
  ];
  for (const k of ranges) {
    const r = (patch as Record<string, unknown>)[k as string] as Range | undefined;
    if (r) {
      if (Number.isFinite(r.min)) params.set(`${String(k)}Min`, String(r.min));
      if (Number.isFinite(r.max)) params.set(`${String(k)}Max`, String(r.max));
    }
  }

  const qs = params.toString();
  return qs ? `/targets?${qs}` : "/targets";
}
