import { jsonResponse, corsPreflight } from "@/lib/v1-auth";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1
 *
 * Discoverability endpoint — returns the list of available endpoints, auth
 * requirements, and a pointer to the dashboard's Settings page for setup
 * instructions. No auth required (this endpoint is intentionally public so
 * tools can discover the API surface).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;

  return jsonResponse({
    api: "Project Whale — customer intelligence",
    version: "v1",
    description:
      "Pre-aggregated customer intelligence for GTSE Hub UK + US. " +
      "All data is mocked in this demo. In production, the same surface " +
      "is backed by a Vercel Postgres warehouse populated by nightly " +
      "Vercel Cron jobs from HubSpot.",
    auth: {
      method: "Bearer token",
      header: "Authorization: Bearer <token>",
      query_fallback: "?token=<token>",
      configure_at: `${base}/settings`,
    },
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/companies",
        description:
          "Filter the customer base. Accepts the same parameters as the dashboard's Target builder.",
        params: [
          "region (UK|US|All)", "limit (1-1000)", "offset",
          "industry (csv)", "size (csv)", "rfm (csv)", "health (csv)", "owner (csv)",
          "whale (true|false)", "intent (true|false)",
          "lifetimeRevenueMin/Max", "ltmRevenueMin/Max", "lapseRatioMin/Max",
          "healthScoreMin/Max", "lifetimeOrdersMin/Max", "daysSinceLastOrderMin/Max",
          "q (name search)",
        ],
      },
      {
        method: "GET",
        path: "/api/v1/companies/{id}",
        description: "Full account detail: company + orders + monthly trend + top SKUs.",
        params: ["include_orders (default true)"],
      },
      {
        method: "GET",
        path: "/api/v1/kpis",
        description: "Headline KPIs and 12-month revenue trend for one region.",
        params: ["region (UK|US)"],
      },
      {
        method: "GET",
        path: "/api/v1/segments",
        description:
          "Phase-2 segment memberships (Whales, Lapsed, Slipping, Ideal, Prospects, " +
          "ReadyForReorder, Hibernating, New, Winback, CrossSell) with company IDs.",
        params: ["region (UK|US)", "include_ids (default true)"],
      },
      {
        method: "GET",
        path: "/api/v1/insights",
        description: "Latest AI-generated insight prose for one region.",
        params: ["region (UK|US|All)", "type (filter to one insight type)"],
      },
      {
        method: "GET",
        path: "/api/v1/top-whales",
        description: "Top-N accounts by LTM revenue.",
        params: ["region (UK|US)", "n (1-200)"],
      },
      {
        method: "GET",
        path: "/api/v1/lapsed",
        description: "Lapsed and/or slipping accounts ranked by lifetime revenue.",
        params: ["region (UK|US)", "include (lapsed,slipping)"],
      },
      {
        method: "GET",
        path: "/api/v1/reorder-due",
        description: "Predicted reorder feed — overdue + upcoming.",
        params: ["region (UK|US)", "within_days (1-120, default 14)", "overdue (default true)"],
      },
    ],
    examples: [
      `curl -H "Authorization: Bearer <token>" "${base}/api/v1/top-whales?region=UK&n=10"`,
      `curl -H "Authorization: Bearer <token>" "${base}/api/v1/companies?region=UK&healthBands=red&lapseRatioMin=2.0"`,
      `curl -H "Authorization: Bearer <token>" "${base}/api/v1/companies/co_uk_0001"`,
    ],
    mcp_setup: {
      status: "documented (Phase 1 deliverable)",
      url_when_live: `${base}/mcp`,
      see: `${base}/settings`,
    },
  });
}
