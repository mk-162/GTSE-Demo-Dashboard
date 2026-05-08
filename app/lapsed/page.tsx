import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { LapsedView } from "./lapsed-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function LapsedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, insight, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "lapsed_priorities"),
    data.nameToIdMap(region),
  ]);

  return <LapsedView region={region} insight={insight} all={all} nameToIdMap={nameMap} />;
}
