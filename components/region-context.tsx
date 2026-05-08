"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export type Region = "UK" | "US";

type RegionContextValue = {
  region: Region;
  setRegion: (r: Region) => void;
};

const RegionContext = React.createContext<RegionContextValue | undefined>(undefined);

const COOKIE_NAME = "whale_region";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const LEGACY_LOCALSTORAGE_KEY = "whale.region";

function writeRegionCookie(r: Region) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${r}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function hasRegionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
}

export function RegionProvider({
  initialRegion,
  children,
}: {
  initialRegion: Region;
  children: React.ReactNode;
}) {
  const [region, setRegionState] = React.useState<Region>(initialRegion);
  const router = useRouter();

  // One-time migration for users who selected a region before the cookie
  // migration: lift their localStorage choice into the cookie + refresh so
  // server components pick it up.
  React.useEffect(() => {
    if (hasRegionCookie()) return;
    try {
      const legacy = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
      if (legacy === "UK" || legacy === "US") {
        writeRegionCookie(legacy);
        if (legacy !== initialRegion) {
          setRegionState(legacy);
          router.refresh();
        }
      }
    } catch {
      // ignore
    }
  }, [initialRegion, router]);

  const setRegion = React.useCallback(
    (r: Region) => {
      setRegionState(r);
      writeRegionCookie(r);
      router.refresh();
    },
    [router],
  );

  const value = React.useMemo(() => ({ region, setRegion }), [region, setRegion]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionContextValue {
  const ctx = React.useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
