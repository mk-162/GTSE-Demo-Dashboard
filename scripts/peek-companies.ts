import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING!);

  // Check column type + jsonb access
  const typeRow = await sql<{ pgtype: string }[]>`
    SELECT pg_typeof(payload)::text AS pgtype FROM raw_hubspot.companies LIMIT 1
  `;
  console.log(`Column type: ${typeRow[0]?.pgtype}`);

  // Test if payload->>'name' returns a string (works if payload is jsonb object)
  const accessTest = await sql<{ name: string | null; industry: string | null; country: string | null }[]>`
    SELECT
      payload->>'name' AS name,
      payload->>'industry' AS industry,
      payload->>'country' AS country
    FROM raw_hubspot.companies
    LIMIT 5
  `;
  console.log("\n5 rows via payload->>:");
  for (const r of accessTest) {
    console.log(`  name=${r.name ?? "NULL"} | industry=${r.industry ?? "NULL"} | country=${r.country ?? "NULL"}`);
  }

  // Country distribution
  const countries = await sql<{ country: string; n: number }[]>`
    SELECT
      coalesce(payload->>'country', '(null)') AS country,
      count(*)::int AS n
    FROM raw_hubspot.companies
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 8
  `;
  console.log("\nTop countries:");
  for (const r of countries) {
    console.log(`  ${r.country.padEnd(30)} ${r.n}`);
  }

  await sql.end();
}
main();
