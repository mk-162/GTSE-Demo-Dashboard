import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { RfmView } from "./rfm-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function RfmPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, insight, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "cross_segment_surprise"),
    data.nameToIdMap(region),
  ]);

  return <RfmView region={region} insight={insight} all={all} nameToIdMap={nameMap} />;
}
