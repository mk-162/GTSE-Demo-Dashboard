import { getData } from "@/lib/data";
import { resolveRegion } from "@/lib/region";
import { paramsToCriteria, mergeCriteria } from "@/lib/criteria-url";
import { EMPTY_CRITERIA, type TargetCriteria } from "@/lib/criteria-types";
import TargetsView from "./targets-view";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function flatten(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TargetsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const region = await resolveRegion(raw.region);

  // Convert searchParams to URLSearchParams so we can reuse the existing codec.
  const url = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    const value = flatten(v);
    if (value !== undefined) url.set(k, value);
  }
  const patch = paramsToCriteria(url);
  const initialCriteria: TargetCriteria = mergeCriteria({
    ...patch,
    region: patch.region ?? region,
  });

  const data = await getData();
  const [results, ranges, owners] = await Promise.all([
    data.filterCompanies(initialCriteria),
    data.fieldRanges(initialCriteria.region),
    data.distinctOwners(initialCriteria.region),
  ]);

  return (
    <TargetsView
      region={region}
      initialCriteria={initialCriteria}
      initialResults={results}
      initialRanges={ranges}
      initialOwners={owners}
    />
  );
}
