import { COMPANIES_UK, COMPANIES_US, type Company } from "@/lib/mock-data/companies";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";
import { serialiseCompany } from "@/lib/v1-serialise";

export const runtime = "edge";

const TODAY = new Date("2026-05-08");

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/reorder-due?region=UK&within_days=14&overdue=true
 *
 * Predicted reorder feed. Returns accounts whose predicted next order date
 * falls inside the requested window. By default returns the next 14 days
 * including overdue (negative day-vs-predicted) accounts.
 */
export async function GET(req: Request) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const region = url.searchParams.get("region") === "US" ? "US" : "UK";
  const withinDays = Math.max(1, Math.min(120, Number(url.searchParams.get("within_days") ?? 14)));
  const includeOverdue = url.searchParams.get("overdue") !== "false";

  const all = region === "UK" ? COMPANIES_UK : COMPANIES_US;
  const rows = all
    .filter((c) => c.lifetimeOrders >= 3)
    .filter((c) => {
      const d = daysVsPredicted(c);
      return (includeOverdue && d < 0 && d >= -90) || (d >= 0 && d <= withinDays);
    })
    .sort((a, b) => daysVsPredicted(a) - daysVsPredicted(b));

  return jsonResponse({
    region,
    within_days: withinDays,
    include_overdue: includeOverdue,
    count: rows.length,
    accounts: rows.map((c) => ({
      ...serialiseCompany(c),
      days_vs_predicted: daysVsPredicted(c),
      expected_order_value: expectedOrderValue(c),
    })),
  });
}

function daysVsPredicted(c: Company): number {
  return Math.round(
    (new Date(c.predictedNextOrderDate).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function expectedOrderValue(c: Company): number {
  const cadence = c.personalCadenceDays ?? 90;
  const orders = Math.max(1, Math.round(365 / cadence));
  return Math.round(c.ltmRevenue / orders);
}
