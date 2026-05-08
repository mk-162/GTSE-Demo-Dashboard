import { getData } from "@/lib/data";
import { paramsToCriteria } from "@/lib/criteria-url";
import { EMPTY_CRITERIA } from "@/lib/criteria-types";

// Browser-dashboard fetches only. Auth is the password cookie via middleware
// (see middleware.ts) — no Bearer token. Never call this from external clients.

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const patch = paramsToCriteria(url.searchParams);
  const criteria = { ...EMPTY_CRITERIA, region: patch.region ?? EMPTY_CRITERIA.region, ...patch };

  const data = await getData();
  const all = await data.filterCompanies(criteria);
  const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get("limit") ?? 5000)));

  return Response.json({
    total: all.length,
    region: criteria.region,
    companies: all.slice(0, limit),
  });
}
