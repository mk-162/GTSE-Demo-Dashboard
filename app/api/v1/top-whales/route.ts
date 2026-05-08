import { getData } from "@/lib/data";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";
import { serialiseCompany } from "@/lib/v1-serialise";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/top-whales?region=UK&n=50
 *
 * Top N accounts by LTM revenue.
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const region = url.searchParams.get("region") === "US" ? "US" : "UK";
  const n = Math.max(1, Math.min(200, Number(url.searchParams.get("n") ?? 50)));

  const data = await getData();
  const top = await data.topNByLtmRevenue(region, n);

  return jsonResponse({
    region,
    n: top.length,
    total_ltm_revenue: top.reduce((s, c) => s + c.ltmRevenue, 0),
    whales: top.map(serialiseCompany),
  });
}
