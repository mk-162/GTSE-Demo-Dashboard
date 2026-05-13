import "server-only";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { getHubSpotClient } from "./hubspot-client";
import { upsertHubSpotObject } from "./upsert";
import { getCursor, setCursor } from "./cursor";

// Contacts use `lastmodifieddate` (not `hs_lastmodifieddate`) as their
// canonical updated timestamp in HubSpot's older Contact schema. We
// still ALSO request hs_lastmodifieddate for newer contact records that
// have it, and fall back between the two when picking the cursor value.
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

function modifiedOf(properties: Record<string, string | null | undefined>): string | null {
  return (properties.hs_lastmodifieddate ?? properties.lastmodifieddate) ?? null;
}

// Backfill: see lib/ingest/pull-companies.ts for the rationale on why
// we use basicApi for initial pull rather than searchApi.
async function backfillContacts(): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = new Date(0);

  do {
    const page = await client.crm.contacts.basicApi.getPage(
      100,
      after,
      [...CONTACT_PROPERTIES],
      undefined,
      undefined,
      false,
    );

    const rows = page.results
      .map((c) => ({
        c,
        modified: modifiedOf(c.properties as Record<string, string | null>),
      }))
      .filter((x): x is { c: typeof x.c; modified: string } => x.modified !== null)
      .map(({ c, modified }) => ({
        hs_object_id: Number(c.id),
        hs_lastmodified: modified,
        payload: c.properties,
      }));

    count += await upsertHubSpotObject("contacts", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

async function incrementalContacts(since: Date): Promise<{ count: number; maxModified: Date }> {
  const client = getHubSpotClient();
  let after: string | undefined;
  let count = 0;
  let maxModified = since;

  do {
    const page = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              // Contacts: `lastmodifieddate`, not `hs_lastmodifieddate`.
              propertyName: "lastmodifieddate",
              operator: FilterOperatorEnum.Gte,
              value: since.getTime().toString(),
            },
          ],
        },
      ],
      properties: [...CONTACT_PROPERTIES],
      sorts: [],
      limit: 100,
      after: after ?? "0",
    });

    const rows = page.results
      .map((c) => ({
        c,
        modified: modifiedOf(c.properties as Record<string, string | null>),
      }))
      .filter((x): x is { c: typeof x.c; modified: string } => x.modified !== null)
      .map(({ c, modified }) => ({
        hs_object_id: Number(c.id),
        hs_lastmodified: modified,
        payload: c.properties,
      }));

    count += await upsertHubSpotObject("contacts", rows);

    for (const r of rows) {
      const ts = new Date(r.hs_lastmodified);
      if (ts > maxModified) maxModified = ts;
    }
    after = page.paging?.next?.after;
  } while (after);

  return { count, maxModified };
}

export async function pullHubSpotContacts(): Promise<number> {
  const since = await getCursor("hubspot", "contacts");
  const { count, maxModified } =
    since === null ? await backfillContacts() : await incrementalContacts(since);
  if (count > 0) await setCursor("hubspot", "contacts", maxModified);
  return count;
}
