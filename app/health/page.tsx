import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { HealthView } from "./health-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function HealthPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, insight, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "health_movers"),
    data.nameToIdMap(region),
  ]);

  return <HealthView region={region} insight={insight} all={all} nameToIdMap={nameMap} />;
}
