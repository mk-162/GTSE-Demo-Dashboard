import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { WhalesView } from "./whales-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function WhalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, insight, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "whale_attention"),
    data.nameToIdMap(region),
  ]);

  const sorted = [...all].sort((a, b) => b.ltmRevenue - a.ltmRevenue);
  const top50 = sorted.slice(0, 50);
  const sumLtm = (start: number, end: number) =>
    sorted.slice(start, end).reduce((s, c) => s + c.ltmRevenue, 0);
  const regionTotalLtm = sorted.reduce((s, c) => s + c.ltmRevenue, 0);

  return (
    <WhalesView
      region={region}
      top50={top50}
      insight={insight}
      regionTotalLtm={regionTotalLtm}
      top10Sum={sumLtm(0, 10)}
      t11_20Sum={sumLtm(10, 20)}
      t21_50Sum={sumLtm(20, 50)}
      nameToIdMap={nameMap}
    />
  );
}
