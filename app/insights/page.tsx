import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { InsightsView } from "./insights-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [uk, us, featured, ukMap, usMap] = await Promise.all([
    data.insightsByRegion("UK"),
    data.insightsByRegion("US"),
    data.insightOf(region, "monthly_narrative"),
    data.nameToIdMap("UK"),
    data.nameToIdMap("US"),
  ]);

  // Merged name map used for linkifying — covers both regions since the feed
  // shows insights from across the book.
  const nameMap = { ...ukMap, ...usMap };
  const allInsights = [...uk, ...us];

  return (
    <InsightsView
      region={region}
      allInsights={allInsights}
      featured={featured}
      nameToIdMap={nameMap}
    />
  );
}
