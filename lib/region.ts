import "server-only";
import { cookies } from "next/headers";
import type { Region } from "@/lib/data/contracts";

export const REGION_COOKIE = "whale_region";

function isRegion(v: string | undefined | null): v is Region {
  return v === "UK" || v === "US";
}

/**
 * Resolve the active region for a server-rendered page. Order of precedence:
 *   1. ?region=UK|US in the URL (deep-linkable override)
 *   2. whale_region cookie (set by RegionProvider when the user toggles)
 *   3. Default "UK"
 *
 * Server-only — Client Components should read `useRegion()` instead.
 */
export async function resolveRegion(
  searchParamsRegion?: string | string[],
): Promise<Region> {
  const fromUrl = Array.isArray(searchParamsRegion) ? searchParamsRegion[0] : searchParamsRegion;
  if (isRegion(fromUrl)) return fromUrl;
  const c = await cookies();
  const fromCookie = c.get(REGION_COOKIE)?.value;
  if (isRegion(fromCookie)) return fromCookie;
  return "UK";
}
