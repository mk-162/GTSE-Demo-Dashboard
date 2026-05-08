import { getData } from "@/lib/data";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/segments?region=UK | US
 *
 * Returns Phase-2 segment memberships (Whales, Lapsed, Slipping, Ideal,
 * Prospects, ReadyForReorder, Hibernating, New, Winback, CrossSell) for
 * one region — including company IDs so the caller can drill in.
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const region = url.searchParams.get("region") === "US" ? "US" : "UK";
  const includeIds = url.searchParams.get("include_ids") !== "false";

  const data = await getData();
  const segments = await data.segmentsByRegion(region);

  return jsonResponse({
    region,
    segments: segments.map((s) => ({
      segment: s.segment,
      count: s.count,
      total_revenue_ltm: s.totalRevenueLtm,
      description: s.description,
      recommended_action: s.recommendedAction,
      action_owner: s.actionOwner,
      company_ids: includeIds ? s.companyIds : null,
    })),
    generated_at: new Date().toISOString(),
  });
}
