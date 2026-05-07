"use client";

import * as React from "react";
import { useRegion } from "./region-context";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function PageShell({ title, subtitle, children }: Props) {
  const { region } = useRegion();

  return (
    <div className="space-y-6">
      <div className="border-b pb-5">
        <div className="gtse-eyebrow text-gtse-orange">Project Whale</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground md:text-base">{subtitle}</p>
        ) : null}
      </div>
      {children}
      <div className="pt-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
        Data refreshed 03:14 today · {region} region · Mock-up
      </div>
    </div>
  );
}
