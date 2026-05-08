import "server-only";
import { getHubSpotClient } from "./hubspot-client";
import { getPool } from "@/lib/db/postgres-pool";

// HubSpot models Deal→Company and Deal→Line-Item relationships in a
// separate Associations API rather than as fields on the deal record.
// We mirror the associations explicitly so staging joins can be SQL-native.
//
// Must be called AFTER pullHubSpotDeals() — we read the deal IDs from
// raw_hubspot.deals to know which associations to fetch.
//
// Batched at 100 deal IDs per call (HubSpot's batch limit). For accounts
// with hundreds of thousands of deals, this would need pagination over
// the deal-id list; current implementation pulls everything in batches.

export async function pullDealAssociations(): Promise<{
  companies: number;
  lineItems: number;
}> {
  const client = getHubSpotClient();
  const sql = getPool();

  const dealRows = await sql<{ hs_object_id: string }[]>`
    SELECT DISTINCT hs_object_id::text AS hs_object_id FROM raw_hubspot.deals
  `;
  const dealIds = dealRows.map((r) => r.hs_object_id);
  if (dealIds.length === 0) return { companies: 0, lineItems: 0 };

  const companyAssocs: { deal_id: number; company_id: number }[] = [];
  const lineItemAssocs: { deal_id: number; line_item_id: number }[] = [];

  for (let i = 0; i < dealIds.length; i += 100) {
    const batch = dealIds.slice(i, i + 100);
    const inputs = batch.map((id) => ({ id }));

    const [coRes, liRes] = await Promise.all([
      client.crm.associations.v4.batchApi.getPage("deal", "company", { inputs }),
      client.crm.associations.v4.batchApi.getPage("deal", "line_item", { inputs }),
    ]);

    for (const r of coRes.results ?? []) {
      const fromId = r._from?.id;
      if (!fromId) continue;
      for (const a of r.to ?? []) {
        companyAssocs.push({
          deal_id: Number(fromId),
          company_id: Number(a.toObjectId),
        });
      }
    }
    for (const r of liRes.results ?? []) {
      const fromId = r._from?.id;
      if (!fromId) continue;
      for (const a of r.to ?? []) {
        lineItemAssocs.push({
          deal_id: Number(fromId),
          line_item_id: Number(a.toObjectId),
        });
      }
    }
  }

  if (companyAssocs.length > 0) {
    await sql`
      INSERT INTO raw_hubspot.assoc_deal_company (deal_id, company_id)
      VALUES ${sql(companyAssocs.map((c) => [c.deal_id, c.company_id]))}
      ON CONFLICT (deal_id, company_id) DO NOTHING
    `;
  }
  if (lineItemAssocs.length > 0) {
    await sql`
      INSERT INTO raw_hubspot.assoc_deal_line_item (deal_id, line_item_id)
      VALUES ${sql(lineItemAssocs.map((l) => [l.deal_id, l.line_item_id]))}
      ON CONFLICT (deal_id, line_item_id) DO NOTHING
    `;
  }

  return { companies: companyAssocs.length, lineItems: lineItemAssocs.length };
}
