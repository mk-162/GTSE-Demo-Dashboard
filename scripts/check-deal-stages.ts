import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING!);

  const stages = await sql<{ dealstage: string; pipeline: string; n: number }[]>`
    SELECT
      coalesce(payload->>'dealstage', '(null)') AS dealstage,
      coalesce(payload->>'pipeline',  '(null)') AS pipeline,
      count(*)::int AS n
    FROM raw_hubspot.deals
    GROUP BY 1, 2
    ORDER BY n DESC
  `;
  console.log("Deal stages × pipelines:");
  for (const r of stages) {
    console.log(`  ${r.dealstage.padEnd(40)} ${r.pipeline.padEnd(40)} ${r.n}`);
  }

  // Sample a closedwon-looking row
  const sample = await sql<{ payload: string }[]>`
    SELECT payload::text FROM raw_hubspot.deals LIMIT 3
  `;
  console.log("\nSample deal payloads (first 3):");
  for (const r of sample) {
    console.log("  " + (r.payload as unknown as string).substring(0, 200));
  }

  await sql.end();
}
main();
