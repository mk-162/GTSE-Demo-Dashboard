// Diagnostic: try four different patterns for inserting jsonb in
// postgres.js to find one that produces a jsonb OBJECT (not a jsonb
// string).

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING!);

  // Create a throwaway table
  await sql`DROP TABLE IF EXISTS test_jsonb`;
  await sql`CREATE TABLE test_jsonb (id int, label text, payload jsonb)`;

  const obj = { name: "Trooli", country: "UK", revenue: 1234.5 };

  // Method A: object directly in template literal
  await sql`INSERT INTO test_jsonb VALUES (1, 'A: object', ${sql.json(obj)})`;

  // Method B: JSON.stringify with explicit ::jsonb cast
  await sql`INSERT INTO test_jsonb VALUES (2, 'B: stringify+cast', ${JSON.stringify(obj)}::jsonb)`;

  // Method C: UNNEST with jsonb[] cast (what upsert.ts currently does)
  const arr = [JSON.stringify(obj)];
  await sql`
    INSERT INTO test_jsonb (id, label, payload)
    SELECT 3, 'C: unnest+jsonb[]', p FROM unnest(${arr}::jsonb[]) AS t(p)
  `;

  // Method D: UNNEST with text[] then per-row cast
  await sql`
    INSERT INTO test_jsonb (id, label, payload)
    SELECT 4, 'D: unnest text+row cast', p::jsonb FROM unnest(${arr}::text[]) AS t(p)
  `;

  // Inspect — does payload->>'name' work for each?
  const results = await sql<{ id: number; label: string; name_via_access: string | null; raw_text: string }[]>`
    SELECT id, label,
           payload->>'name' AS name_via_access,
           payload::text AS raw_text
    FROM test_jsonb
    ORDER BY id
  `;

  for (const r of results) {
    console.log(`${r.label}`);
    console.log(`  name access: ${r.name_via_access ?? "NULL ✗"}`);
    console.log(`  raw text:    ${r.raw_text.substring(0, 100)}`);
    console.log("");
  }

  await sql`DROP TABLE test_jsonb`;
  await sql.end();
}
main();
