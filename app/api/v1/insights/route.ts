import { getData } from "@/lib/data";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/insights?region=UK | US | All&type=...
 *
 * Returns AI-generated insights. By default returns all insights for the
 * specified region. Filter by `type` to get one specific insight type
 * (kpi_summary, whale_attention, lapsed_priorities, reorder_urgency,
 * cross_segment_surprise, monthly_narrative, health_movers,
 * cross_sell_opportunities).
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const regionParam = url.searchParams.get("region");
  const type = url.searchParams.get("type") || undefined;

  const region = regionParam === "US" ? "US" : regionParam === "All" ? "All" : "UK";
  const data = await getData();

  const list = region === "All"
    ? [...(await data.insightsByRegion("UK")), ...(await data.insightsByRegion("US"))]
    : await data.insightsByRegion(region);

  const filtered = type ? list.filter((i) => i.insightType === type) : list;

  return jsonResponse({
    region,
    type: type ?? null,
    insights: filtered.map((i) => ({
      id: i.id,
      insight_type: i.insightType,
      region: i.region,
      generated_at: i.generatedAt,
      body_markdown: i.bodyMarkdown,
      data_snapshot_summary: i.dataSnapshotSummary,
    })),
  });
}
