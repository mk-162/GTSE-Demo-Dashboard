import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "jobtitle",
  "lifecyclestage",
  "hubspot_owner_id",
  "createdate",
  "lastmodifieddate",
  "hs_lastmodifieddate",
] as const;

export async function pullHubSpotContacts(): Promise<number> {
  const client = getHubSpotClient();
  const since = await getCursor("hubspot", "contacts");
  let after: string | undefined;
  let total = 0;
  let maxModified = since ?? new Date(0);

  do {
    const page = await client.crm.contacts.searchApi.doSearch({
      filterGroups: since
        ? [
            {
              filters: [
                {
                  propertyName: "lastmodifieddate",
                  operator: FilterOperatorEnum.Gte,
                  value: since.getTime().toString(),
                },
              ],
            },
          ]
        : [],
      properties: [...CONTACT_PROPERTIES],
      limit: 100,
      after,
    });

    const rows = page.results
      .filter((c) => c.properties.lastmodifieddate ?? c.properties.hs_lastmodifieddate)
      .map((c) => {
        const modified = (c.properties.hs_lastmodifieddate ?? c.properties.lastmodifieddate) as string;
        return {
          hs_object_id: Number(c.id),
          hs_lastmodified: modified,
          payload: c.properties,
        };
      });

    total += await upsertHubSpotObject("contacts", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  if (total > 0) await setCursor("hubspot", "contacts", maxModified);
  return total;
}
