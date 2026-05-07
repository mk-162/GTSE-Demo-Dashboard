export * from "./companies";
export * from "./skus";
export * from "./segments";
export * from "./kpis";
export * from "./insights";
export type { Industry } from "./name-banks";

import { COMPANIES_UK, COMPANIES_US, type Company } from "./companies";

export function companyById(id: string): Company | undefined {
  return COMPANIES_UK.find((c) => c.id === id) ?? COMPANIES_US.find((c) => c.id === id);
}

// Find a company by best-effort name match (case-insensitive substring).
// Used by insight prose linkifying — given "Sheffield Steelworks" find that account.
export function companyByName(name: string): Company | undefined {
  const q = name.toLowerCase().trim();
  if (!q) return undefined;
  // Exact match first, then prefix, then substring
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
}

export function topNByLtmRevenue(region: "UK" | "US", n: number): Company[] {
  const list = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  return [...list].sort((a, b) => b.ltmRevenue - a.ltmRevenue).slice(0, n);
}

export function lapsedByRegion(region: "UK" | "US"): Company[] {
  const list = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  return list.filter((c) => c.lapseRatio >= 2.0);
}

export function slippingByRegion(region: "UK" | "US"): Company[] {
  const list = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  return list.filter((c) => c.lapseRatio >= 1.0 && c.lapseRatio < 2.0);
}

export type LapsedTier = "Slipping" | "Lapsing" | "Lapsed" | "Dormant";
export function lapsedTier(c: Company): LapsedTier {
  if (c.lapseRatio < 1.0) return "Slipping";
  if (c.lapseRatio < 1.5) return "Slipping";
  if (c.lapseRatio < 2.5) return "Lapsing";
  if (c.lapseRatio < 4.0) return "Lapsed";
  return "Dormant";
}
