import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { ReorderView } from "./reorder-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function ReorderPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, insight, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "reorder_urgency"),
    data.nameToIdMap(region),
  ]);

  return <ReorderView region={region} insight={insight} all={all} nameToIdMap={nameMap} />;
}
