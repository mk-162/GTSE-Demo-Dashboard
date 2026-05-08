import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { SegmentsView } from "./segments-view";

type SearchParams = Promise<{ region?: string | string[] }>;

export default async function SegmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const region = await resolveRegion(params.region);
  const data = await getData();
  const segments = await data.segmentsByRegion(region);

  return <SegmentsView region={region} segments={segments} />;
}
