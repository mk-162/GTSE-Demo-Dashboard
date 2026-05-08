import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { HomeView } from "./home-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const [all, monthly, nameMap] = await Promise.all([
    data.companiesByRegion(region),
    data.insightOf(region, "monthly_narrative"),
    data.nameToIdMap(region),
  ]);

  return <HomeView region={region} all={all} monthly={monthly} nameToIdMap={nameMap} />;
}
