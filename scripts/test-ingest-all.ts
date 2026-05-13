// One-shot full HubSpot ingest. Runs every pull module sequentially —
// companies (skipped if already cursor-advanced), deals, line items,
// contacts — then deal associations. Mirrors what
// /api/cron/ingest-hubspot/route.ts does, just invokable from the CLI.
//
// Run via:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx --env-file=.env.local scripts/test-ingest-all.ts

import { pullHubSpotCompanies } from "../lib/ingest/pull-companies";
import { pullHubSpotDeals } from "../lib/ingest/pull-deals";
import { pullHubSpotLineItems } from "../lib/ingest/pull-line-items";
import { pullHubSpotContacts } from "../lib/ingest/pull-contacts";
import { pullDealAssociations } from "../lib/ingest/pull-deal-associations";

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.log(`\n→ ${label} starting...`);
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✓ ${label} done in ${elapsed}s`);
    return result;
  } catch (e) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✗ ${label} failed after ${elapsed}s`);
    console.log(`  ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    throw e;
  }
}

async function main() {
  console.log("=== Full HubSpot ingest ===");
  console.log("");

  const companies = await timed("pull-companies", pullHubSpotCompanies);
  console.log(`  → ${companies} new company rows`);

  const deals = await timed("pull-deals", pullHubSpotDeals);
  console.log(`  → ${deals} new deal rows`);

  const lineItems = await timed("pull-line-items", pullHubSpotLineItems);
  console.log(`  → ${lineItems} new line item rows`);

  const contacts = await timed("pull-contacts", pullHubSpotContacts);
  console.log(`  → ${contacts} new contact rows`);

  // Associations must run AFTER deals so it can read deal_ids from
  // raw_hubspot.deals.
  const associations = await timed("pull-deal-associations", pullDealAssociations);
  console.log(`  → ${associations.companies} deal→company links, ${associations.lineItems} deal→line_item links`);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("\nFatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
