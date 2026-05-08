import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { CrossSellView } from "./crosssell-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function CrossSellPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, insight, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "cross_sell_opportunities"),
    data.nameToIdMap(region),
  ]);

  return <CrossSellView region={region} insight={insight} all={all} nameToIdMap={nameMap} />;
}
