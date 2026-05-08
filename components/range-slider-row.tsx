"use client";

import * as React from "react";
import { Slider } from "@/components/ui/slider";
import type { Range } from "@/lib/criteria-types";
import type { FieldRange } from "@/lib/data/contracts";

type Props = {
  label: string;
  bound: FieldRange;
  value?: Range;
  format?: (n: number) => string;
  onChange: (next: Range | undefined) => void;
};

export function RangeSliderRow({ label, bound, value, format, onChange }: Props) {
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString());
  const min = bound.min;
  const max = bound.max;
  const step = bound.step;

  const current: [number, number] = value
    ? [Math.max(min, value.min), Math.min(max, value.max)]
    : [min, max];
  const isDefault = current[0] === min && current[1] === max;

  // Use uncontrolled defaultValue, sync via key when bounds change.
  const sliderKey = `${label}-${min}-${max}`;
  const [pending, setPending] = React.useState<[number, number]>(current);

  React.useEffect(() => {
    setPending(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="font-mono text-muted-foreground">
          {fmt(pending[0])} – {fmt(pending[1])}
        </span>
      </div>
      <Slider
        key={sliderKey}
        min={min}
        max={max}
        step={step}
        value={pending}
        onValueChange={(v: number[]) => setPending([v[0], v[1]] as [number, number])}
        onValueCommit={(v: number[]) => {
          const [lo, hi] = v as [number, number];
          if (lo === min && hi === max) onChange(undefined);
          else onChange({ min: lo, max: hi });
        }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{fmt(min)}</span>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-gtse-orange hover:underline"
          >
            reset
          </button>
        ) : null}
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
