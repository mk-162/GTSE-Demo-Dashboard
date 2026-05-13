import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING!);
  const [r] = await sql<{ total: number; unique_companies: number }[]>`
    SELECT count(*)::int AS total, count(DISTINCT hs_object_id)::int AS unique_companies
    FROM raw_hubspot.companies
  `;
  console.log(`Total rows: ${r.total}`);
  console.log(`Unique companies: ${r.unique_companies}`);
  console.log(`Duplicate rows: ${r.total - r.unique_companies}`);
  await sql.end();
}
main();
