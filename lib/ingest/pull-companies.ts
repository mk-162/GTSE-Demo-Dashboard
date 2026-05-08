import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/companies/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// PHASE 0: confirm the property names in this list. The `netsuite_customer_id`
// property is the join key to NetSuite — Phase 0 §A6 confirms whether it
// exists on every active Company and what the actual property name is. If
// it's named differently (e.g. `gtse_netsuite_id`), update the string and
// the staging.customer view in migration 005.
const COMPANY_PROPERTIES = [
  "name",
  "industry",
  "country",
  "numberofemployees",
  "lifecyclestage",
  "hubspot_owner_id",
  "createdate",
  "hs_lastmodifieddate",
  "netsuite_customer_id", // PHASE 0
] as const;

export async function pullHubSpotCompanies(): Promise<number> {
  const client = getHubSpotClient();
  const since = await getCursor("hubspot", "companies");
  let after: string | undefined;
  let total = 0;
  let maxModified = since ?? new Date(0);

  do {
    const page = await client.crm.companies.searchApi.doSearch({
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
      properties: [...COMPANY_PROPERTIES],
      limit: 100,
      after,
    });

    const rows = page.results
      .filter((c) => c.properties.hs_lastmodifieddate)
      .map((c) => ({
        hs_object_id: Number(c.id),
        hs_lastmodified: c.properties.hs_lastmodifieddate as string,
        payload: c.properties,
      }));

    total += await upsertHubSpotObject("companies", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  // Only advance the cursor if we actually pulled something — a no-op run
  // shouldn't reset to "now" and skip records that arrive in the gap.
  if (total > 0) await setCursor("hubspot", "companies", maxModified);
  return total;
}
