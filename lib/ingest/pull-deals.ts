import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/deals/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// PHASE 0: confirm the deal stage value that means "closed-won / shipped"
// (§A1). The staging view in migration 005 filters on this value; the
// pull itself takes everything and lets staging decide.
const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "pipeline",
  "amount",
  "closedate",
  "createdate",
  "hubspot_owner_id",
  "hs_lastmodifieddate",
] as const;

export async function pullHubSpotDeals(): Promise<number> {
  const client = getHubSpotClient();
  const since = await getCursor("hubspot", "deals");
  let after: string | undefined;
  let total = 0;
  let maxModified = since ?? new Date(0);

  do {
    const page = await client.crm.deals.searchApi.doSearch({
      filterGroups: since
        ? [
            {
              filters: [
                {
                  propertyName: "hs_lastmodifieddate",
                  operator: FilterOperatorEnum.Gte,
                  value: since.getTime().toString(),
                },
              ],
            },
          ]
        : [],
      properties: [...DEAL_PROPERTIES],
      limit: 100,
      after,
    });

    const rows = page.results
      .filter((d) => d.properties.hs_lastmodifieddate)
      .map((d) => ({
        hs_object_id: Number(d.id),
        hs_lastmodified: d.properties.hs_lastmodifieddate as string,
        payload: d.properties,
      }));

    total += await upsertHubSpotObject("deals", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  if (total > 0) await setCursor("hubspot", "deals", maxModified);
  return total;
}
