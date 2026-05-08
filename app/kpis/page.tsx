import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { KpisView } from "./kpis-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function KpisPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [k, insight, cs, nameMap] = await Promise.all([
    data.kpisByRegion(region),
    data.insightOf(region, "kpi_summary"),
    data.companiesByRegion(region),
    data.nameToIdMap(region),
  ]);

  return <KpisView region={region} k={k} insight={insight} cs={cs} nameToIdMap={nameMap} />;
}
