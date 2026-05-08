import { getData } from "@/lib/data";

// Browser-dashboard fetches only. Returns a lower-cased company name → id map
// used by the markdown linkifier in chat + insight banner. The map is small
// enough (~30 KB JSON for 8000 names) to fetch once on dashboard load.
//
// Auth: password cookie via middleware. Never call from external clients.

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regionParam = url.searchParams.get("region");

  const data = await getData();

  let map: Record<string, string>;
  if (regionParam === "UK" || regionParam === "US") {
    map = await data.nameToIdMap(regionParam);
  } else {
    const [uk, us] = await Promise.all([data.nameToIdMap("UK"), data.nameToIdMap("US")]);
    map = { ...uk, ...us };
  }

  return Response.json({ companies: map });
}
