"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  bodyMarkdown: string;
  generatedAt: string;
  dataSnapshotSummary: string;
  className?: string;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date("2026-05-07");
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (isToday) return `${time} today`;
  if (isYesterday) return `${time} yesterday`;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${time} on ${date}`;
}

// Tiny inline markdown — supports **bold** and *italic* only.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end === -1) { out.push(text.slice(i)); break; }
      out.push(<strong key={key++} className="font-semibold text-foreground">{text.slice(i + 2, end)}</strong>);
      i = end + 2;
    } else if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end === -1) { out.push(text.slice(i)); break; }
      out.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
      i = end + 1;
    } else {
      const next = text.indexOf("**", i);
      const nextItalic = text.indexOf("*", i);
      const stop = [next, nextItalic].filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? text.length;
      out.push(text.slice(i, stop));
      i = stop;
    }
  }
  return out;
}

export function InsightBanner({ bodyMarkdown, generatedAt, dataSnapshotSummary, className }: Props) {
  const paragraphs = bodyMarkdown.split(/\n\n+/);
  return (
    <section
      className={cn(
        "gtse-insight relative overflow-hidden rounded-sm p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-gtse-orange text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-[0.12em] text-gtse-orange">AI insight</span>
            <span className="text-muted-foreground">• Generated {fmtTime(generatedAt)}</span>
          </div>
          <div className="space-y-2 text-[15px] leading-relaxed text-foreground/90">
            {paragraphs.map((p, idx) => (
              <p key={idx}>{renderInline(p)}</p>
            ))}
          </div>
          <p className="mt-3 text-xs italic text-muted-foreground">{dataSnapshotSummary}</p>
        </div>
      </div>
    </section>
  );
}
