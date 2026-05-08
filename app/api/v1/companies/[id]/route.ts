import { companyById } from "@/lib/mock-data";
import { generateOrdersFor, ordersByMonth, topSkus } from "@/lib/mock-data/orders";
import { requireApiToken, jsonResponse, corsPreflight } from "@/lib/v1-auth";
import { serialiseCompany } from "@/lib/v1-serialise";

export const runtime = "edge";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * GET /api/v1/companies/:id
 *
 * Full account detail: company record + order history + top SKUs + monthly trend.
 *
 * Auth: Bearer token in Authorization header, or ?token=...
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const unauth = requireApiToken(req);
  if (unauth) return unauth;

  const { id } = await ctx.params;
  const company = companyById(decodeURIComponent(id));
  if (!company) {
    return jsonResponse({ error: "not_found", id }, { status: 404 });
  }

  const url = new URL(req.url);
  const includeOrders = url.searchParams.get("include_orders") !== "false";

  const orders = includeOrders ? generateOrdersFor(company) : [];

  return jsonResponse({
    company: serialiseCompany(company),
    orders: includeOrders
      ? orders.map((o) => ({
          id: o.id,
          date: o.date,
          total: o.total,
          line_items: o.lineItems,
        }))
      : null,
    monthly_revenue: includeOrders ? ordersByMonth(orders) : null,
    top_skus: includeOrders
      ? topSkus(orders, 10).map((row) => ({
          sku_code: row.sku.code,
          sku_name: row.sku.name,
          category: row.sku.category,
          spend: row.spend,
          qty: row.qty,
          orders: row.orders,
        }))
      : null,
    generated_at: new Date().toISOString(),
  });
}
