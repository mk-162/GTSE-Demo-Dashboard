"use client";

import { ChevronDown, Check } from "lucide-react";
import { PopoverMenu, PopoverMenuTrigger, PopoverMenuContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props<T extends string> = {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  className?: string;
};

export function MultiSelect<T extends string>({ label, options, selected, onChange, className }: Props<T>) {
  const summary =
    selected.length === 0
      ? "Any"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  function toggle(opt: T) {
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
    else onChange([...selected, opt]);
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="text-xs font-medium text-foreground/80">{label}</div>
      <PopoverMenu>
        <PopoverMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-sm border bg-background px-3 text-sm shadow-sm hover:bg-accent/30"
          >
            <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
              {summary}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        </PopoverMenuTrigger>
        <PopoverMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto" align="start">
          <div className="flex items-center justify-between border-b px-2 py-1.5 text-[11px]">
            <span className="text-muted-foreground">{selected.length} of {options.length}</span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-gtse-orange hover:underline disabled:opacity-50"
              disabled={selected.length === 0}
            >
              Clear
            </button>
          </div>
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent/40"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                    checked ? "border-gtse-orange bg-gtse-orange text-white" : "border-input bg-background",
                  )}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </PopoverMenuContent>
      </PopoverMenu>
    </div>
  );
}
