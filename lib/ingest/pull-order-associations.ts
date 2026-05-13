import "server-only";
import { getHubSpotClient } from "./hubspot-client";
import { getPool } from "@/lib/db/postgres-pool";

// Pull Order → Company associations into raw_hubspot.assoc_order_company.
// Needed for attributing each order's revenue to the right customer in
// the dashboard. Order → Line Item associations are also useful but
// deferred — Phase 1 dashboard works at the order-total level.
//
// Must run AFTER pullHubSpotOrders() — reads order IDs from
// raw_hubspot.orders to know which associations to fetch.
//
// Batched at 100 order IDs per call (HubSpot's Associations API limit).
// 74k orders / 100 = ~750 API calls at ~5/sec rate limit = ~2.5 min.

export async function pullOrderAssociations(): Promise<{ companies: number }> {
  const client = getHubSpotClient();
  const sql = getPool();

  const orderRows = await sql<{ hs_object_id: string }[]>`
    SELECT DISTINCT hs_object_id::text AS hs_object_id FROM raw_hubspot.orders
  `;
  const orderIds = orderRows.map((r) => r.hs_object_id);
  if (orderIds.length === 0) return { companies: 0 };

  const companyAssocs: { order_id: number; company_id: number }[] = [];

  for (let i = 0; i < orderIds.length; i += 100) {
    const batch = orderIds.slice(i, i + 100);
    const inputs = batch.map((id) => ({ id }));

    const res = await client.crm.associations.v4.batchApi.getPage("order", "company", { inputs });

    for (const r of res.results ?? []) {
      const fromId = r._from?.id;
      if (!fromId) continue;
      for (const a of r.to ?? []) {
        companyAssocs.push({
          order_id: Number(fromId),
          company_id: Number(a.toObjectId),
        });
      }
    }
  }

  if (companyAssocs.length === 0) return { companies: 0 };

  // Postgres has a hard limit of 65,534 parameters per query. With ~75k
  // order associations × 2 params each = 150k+ params, blows the limit.
  // Same UNNEST pattern as upsert.ts — pass two arrays as 2 params total,
  // unnest them in SQL to get N rows of (order_id, company_id).
  const orderIdsForInsert = companyAssocs.map((c) => c.order_id);
  const companyIdsForInsert = companyAssocs.map((c) => c.company_id);

  await sql`
    INSERT INTO raw_hubspot.assoc_order_company (order_id, company_id)
    SELECT o, c FROM unnest(${orderIdsForInsert}::bigint[], ${companyIdsForInsert}::bigint[]) AS t(o, c)
    ON CONFLICT (order_id, company_id) DO NOTHING
  `;

  return { companies: companyAssocs.length };
}
