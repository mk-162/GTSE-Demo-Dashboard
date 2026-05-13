import { runTransform } from "@/lib/transform/run-transform";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  // Auth required everywhere — see master plan §13.5.
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runTransform();
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
