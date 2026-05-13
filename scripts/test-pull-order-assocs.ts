import { pullOrderAssociations } from "../lib/ingest/pull-order-associations";

async function main() {
  console.log("Pulling order → company associations...");
  const start = Date.now();
  const r = await pullOrderAssociations();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✓ ${r.companies} associations upserted in ${elapsed}s`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
