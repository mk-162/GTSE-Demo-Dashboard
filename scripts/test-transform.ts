// One-shot transform: refreshes all marts + runs retention cleanup.
// Same logic as /api/cron/transform/route.ts, just invokable from CLI.
//
// Run via:
//   NODE_OPTIONS="--conditions=react-server" pnpm tsx --env-file=.env.local scripts/test-transform.ts

import { runTransform } from "../lib/transform/run-transform";

async function main() {
  console.log("Refreshing marts + retention cleanup...");
  const start = Date.now();
  const result = await runTransform();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`✓ Transform succeeded in ${elapsed}s`);
  console.log(`  run_id: ${result.run_id}`);
  console.log("");
  console.log("Mart row counts:");
  for (const [view, n] of Object.entries(result.counts)) {
    console.log(`  ${view.padEnd(30)} ${n.toLocaleString()}`);
  }
  console.log("");
  console.log("Retention cleanup:");
  if (result.cleanup) {
    console.log(`  ingestion_runs deleted:     ${result.cleanup.ingestion_runs_deleted}`);
    console.log(`  api_access_log deleted:     ${result.cleanup.api_access_log_deleted}`);
    console.log(`  expired_sessions deleted:   ${result.cleanup.expired_sessions_deleted}`);
    console.log(`  auth_audit deleted:         ${result.cleanup.auth_audit_deleted}`);
  }
}

main().catch((e) => {
  console.error("✗ Transform failed:");
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
