// One-shot CLI to apply db/migrations/*.sql against the database in
// DATABASE_URL. Run with `pnpm db:migrate` (which loads env from
// .env.local — pull it first with `vercel env pull .env.local`).
//
// Idempotent: only previously-unapplied migrations run.

import { runMigrations } from "../lib/db/migrate";

(async () => {
  try {
    const { applied } = await runMigrations();
    if (applied.length === 0) {
      console.log("✓ No new migrations to apply (everything in db/migrations/* is up to date)");
    } else {
      console.log(`✓ Applied ${applied.length} migration${applied.length === 1 ? "" : "s"}:`);
      for (const id of applied) console.log(`  - ${id}`);
    }
    process.exit(0);
  } catch (e) {
    console.error("✗ Migration failed:");
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
})();
