// Query HubSpot Pipelines API to enumerate deal pipelines + stages,
// flagging the ones that represent "closed-won / shipped" via their
// metadata.probability and metadata.isClosed fields.

export {}; // force module mode so `main` doesn't collide with sibling scripts

type Stage = {
  id: string;
  label: string;
  displayOrder: number;
  metadata?: { isClosed?: string; probability?: string };
};

type Pipeline = {
  id: string;
  label: string;
  stages: Stage[];
};

async function main() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    console.error("HUBSPOT_PRIVATE_APP_TOKEN not set");
    process.exit(1);
  }

  const res = await fetch("https://api.hubapi.com/crm/v3/pipelines/deals", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const { results: pipelines } = (await res.json()) as { results: Pipeline[] };

  console.log(`Found ${pipelines.length} deal pipelines:`);
  console.log("");

  for (const p of pipelines) {
    console.log(`Pipeline: ${p.label} (id=${p.id})`);
    for (const s of p.stages.sort((a, b) => a.displayOrder - b.displayOrder)) {
      const isClosed = s.metadata?.isClosed === "true";
      const prob = s.metadata?.probability ?? "?";
      const won = isClosed && prob === "1.0";
      const lost = isClosed && prob === "0.0";
      const marker = won ? "✓ WON" : lost ? "✗ lost" : "  open";
      console.log(`  ${marker}  id=${s.id.padEnd(12)} prob=${prob.padEnd(5)} ${s.label}`);
    }
    console.log("");
  }

  // Collect all won-stage IDs for use in SQL
  const wonIds = pipelines.flatMap((p) =>
    p.stages
      .filter((s) => s.metadata?.isClosed === "true" && s.metadata?.probability === "1.0")
      .map((s) => s.id),
  );
  console.log(`Closed-won stage IDs (for SQL filter):`);
  console.log(`  ${wonIds.map((id) => `'${id}'`).join(", ")}`);
}

main().catch((e) => console.error("Error:", e instanceof Error ? e.message : String(e)));
