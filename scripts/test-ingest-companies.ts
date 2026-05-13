// One-shot smoke test: pulls HubSpot companies and writes them to
// raw_hubspot.companies. Proves the token, the pull module, and the DB
// write path all work end-to-end without needing the cron HTTP route.
//
// Run via:
//   tsx --node-options="--conditions=react-server" --env-file=.env.local scripts/test-ingest-companies.ts
//
// The --conditions=react-server flag makes `import "server-only"`
// resolve to a noop (same trick Next.js's bundler uses), so the pull
// modules can be invoked from a plain Node script.

import { pullHubSpotCompanies } from "../lib/ingest/pull-companies";

async function main() {
  console.log("Pulling HubSpot companies (incremental, cursor-aware)...");
  const start = Date.now();
  const total = await pullHubSpotCompanies();
  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✓ Pulled ${total} companies in ${elapsedSec}s`);
  if (total === 0) {
    console.log("");
    console.log("(0 rows is OK on a 2nd+ run if no companies modified since last cursor.)");
    console.log("(0 rows on the FIRST run probably means the token can't see companies");
    console.log(" or the GTSE portal is empty.)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ Pull failed:");
    console.error(e instanceof Error ? e.stack ?? e.message : String(e));
    process.exit(1);
  });
