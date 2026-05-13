import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL_NON_POOLING!);

  const audit = await sql<{
    event: string;
    hub_user_email: string | null;
    hub_id: string | null;
    reason: string | null;
    created_at: Date;
  }[]>`
    SELECT event, hub_user_email, hub_id, reason, created_at
    FROM app.auth_audit
    ORDER BY created_at DESC
    LIMIT 10
  `;

  console.log(`Recent auth events (${audit.length}):`);
  for (const r of audit) {
    const ts = r.created_at.toISOString().replace("T", " ").slice(0, 19);
    console.log(
      `  ${ts}  ${r.event.padEnd(20)}  ${(r.hub_user_email ?? "—").padEnd(30)}  hub=${r.hub_id ?? "—"}  ${r.reason ?? ""}`,
    );
  }

  const sessions = await sql<{
    hub_user_email: string;
    hub_user_name: string | null;
    created_at: Date;
    expires_at: Date;
  }[]>`
    SELECT hub_user_email, hub_user_name, created_at, expires_at
    FROM app.sessions
    WHERE expires_at > now()
  `;

  console.log(`\nActive sessions (${sessions.length}):`);
  for (const s of sessions) {
    const created = s.created_at.toISOString().slice(0, 19).replace("T", " ");
    const expires = s.expires_at.toISOString().slice(0, 10);
    console.log(`  ${s.hub_user_email}  (${s.hub_user_name ?? "no name"})  created ${created}  expires ${expires}`);
  }

  await sql.end();
}
main();
