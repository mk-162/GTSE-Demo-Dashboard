import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({ className, orientation = "horizontal", ...props }: { orientation?: "horizontal" | "vertical" } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
