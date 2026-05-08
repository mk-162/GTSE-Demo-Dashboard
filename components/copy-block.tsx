"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  language?: string;
  className?: string;
};

export function CopyBlock({ value, language, className }: Props) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className={cn("relative rounded-sm border bg-muted/40", className)}>
      {language ? (
        <div className="border-b bg-muted/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {language}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{value}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-sm border bg-background/90 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
