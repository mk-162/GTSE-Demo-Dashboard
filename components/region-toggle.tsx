"use client";

import { useRegion } from "./region-context";
import { cn } from "@/lib/utils";

export function RegionToggle() {
  const { region, setRegion } = useRegion();
  return (
    <div className="inline-flex items-center rounded-sm border bg-background p-0.5 text-xs">
      <button
        type="button"
        onClick={() => setRegion("UK")}
        className={cn(
          "rounded-[2px] px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors",
          region === "UK"
            ? "bg-gtse-teal text-white"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={region === "UK"}
      >
        🇬🇧 UK
      </button>
      <button
        type="button"
        onClick={() => setRegion("US")}
        className={cn(
          "rounded-[2px] px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors",
          region === "US"
            ? "bg-gtse-teal text-white"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={region === "US"}
      >
        🇺🇸 US
      </button>
    </div>
  );
}
