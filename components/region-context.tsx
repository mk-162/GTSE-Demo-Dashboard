"use client";

import * as React from "react";

export type Region = "UK" | "US";

type RegionContextValue = {
  region: Region;
  setRegion: (r: Region) => void;
};

const RegionContext = React.createContext<RegionContextValue | undefined>(undefined);

const STORAGE_KEY = "whale.region";

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = React.useState<Region>("UK");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "UK" || saved === "US") setRegionState(saved);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setRegion = React.useCallback((r: Region) => {
    setRegionState(r);
    try {
      window.localStorage.setItem(STORAGE_KEY, r);
    } catch {
      // ignore
    }
  }, []);

  const value = React.useMemo(() => ({ region, setRegion }), [region, setRegion]);

  // Avoid hydration mismatch — render children only once we've read localStorage.
  if (!hydrated) {
    return (
      <RegionContext.Provider value={value}>
        <div suppressHydrationWarning>{children}</div>
      </RegionContext.Provider>
    );
  }

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionContextValue {
  const ctx = React.useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
