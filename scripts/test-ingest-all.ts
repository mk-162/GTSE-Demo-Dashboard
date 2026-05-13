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
import { pullHubSpotOwners } from "../lib/ingest/pull-owners";
import { pullHubSpotOrders } from "../lib/ingest/pull-orders";
import { pullDealAssociations } from "../lib/ingest/pull-deal-associations";
import { pullOrderAssociations } from "../lib/ingest/pull-order-associations";

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

  const owners = await timed("pull-owners", pullHubSpotOwners);
  console.log(`  → ${owners} owner rows upserted`);

  const orders = await timed("pull-orders", pullHubSpotOrders);
  console.log(`  → ${orders} new order rows`);

  // Associations must run AFTER their parents.
  const associations = await timed("pull-deal-associations", pullDealAssociations);
  console.log(`  → ${associations.companies} deal→company links, ${associations.lineItems} deal→line_item links`);

  const orderAssocs = await timed("pull-order-associations", pullOrderAssociations);
  console.log(`  → ${orderAssocs.companies} order→company links`);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("\nFatal:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
