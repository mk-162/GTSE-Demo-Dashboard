import { getData } from "@/lib/data";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";
import { serialiseCompany } from "@/lib/v1-serialise";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/lapsed?region=UK&include=lapsed,slipping
 *
 * Lapsed (lapse_ratio >= 2.0) and/or slipping (>= 1.0) accounts.
 * Defaults to lapsed only.
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const region = url.searchParams.get("region") === "US" ? "US" : "UK";
  const include = (url.searchParams.get("include") ?? "lapsed").split(",").map((s) => s.trim());

  const data = await getData();
  const all = await data.companiesByRegion(region);
  const lapsed = all.filter((c) => c.lapseRatio >= 2.0);
  const slipping = all.filter((c) => c.lapseRatio >= 1.0 && c.lapseRatio < 2.0);

  const buckets: Record<string, number> = {};
  let rows = include.includes("lapsed") ? [...lapsed] : [];
  buckets.lapsed = include.includes("lapsed") ? lapsed.length : 0;

  if (include.includes("slipping")) {
    rows = [...rows, ...slipping];
    buckets.slipping = slipping.length;
  }

  rows.sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue);

  return jsonResponse({
    region,
    include,
    counts: buckets,
    total_lifetime_revenue_at_risk: rows.reduce((s, c) => s + c.lifetimeRevenue, 0),
    accounts: rows.map(serialiseCompany),
  });
}
