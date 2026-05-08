import { getData } from "@/lib/data";
import { paramsToCriteria } from "@/lib/criteria-url";
import { EMPTY_CRITERIA } from "@/lib/criteria-types";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";
import { serialiseCompany } from "@/lib/v1-serialise";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/companies
 *
 * Filter the customer base. Accepts the same URL parameters as the dashboard's
 * Target builder (region, industry, healthBands, lapseRatioMin/Max, etc.).
 *
 * Query params:
 *   - region: UK | US | All  (default: All)
 *   - limit: max rows to return (default 100, max 1000)
 *   - offset: row offset (default 0)
 *   - All filter params from /targets URL — see /settings for full list
 *
 * Auth: Bearer token in Authorization header, or ?token=...
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const patch = paramsToCriteria(url.searchParams);
  const criteria = { ...EMPTY_CRITERIA, region: patch.region ?? "All", ...patch };

  const limit = clamp(Number(url.searchParams.get("limit") ?? 100), 1, 1000);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const data = await getData();
  const all = await data.filterCompanies(criteria);
  const slice = all.slice(offset, offset + limit);

  return jsonResponse({
    total: all.length,
    limit,
    offset,
    region: criteria.region,
    companies: slice.map(serialiseCompany),
    meta: {
      generated_at: new Date().toISOString(),
    },
  });
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
