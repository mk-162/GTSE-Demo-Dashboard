import { pullHubSpotOwners } from "../lib/ingest/pull-owners";

async function main() {
  const start = Date.now();
  const n = await pullHubSpotOwners();
  console.log(`✓ Pulled ${n} owners in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
