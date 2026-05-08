"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { companyByName } from "@/lib/mock-data";
import type { InsightType } from "@/lib/mock-data/insights";

type Props = {
  bodyMarkdown: string;
  generatedAt: string;
  dataSnapshotSummary: string;
  className?: string;
  // If both insightType + region are provided, the "Regenerate" button is shown.
  insightType?: InsightType;
  region?: "UK" | "US";
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

// Tiny inline markdown — supports **bold** and *italic*. Bold spans that match
// a known company name become clickable links to the account-detail page.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end === -1) { out.push(text.slice(i)); break; }
      const inner = text.slice(i + 2, end);
      const company = companyByName(inner);
      if (company) {
        out.push(
          <Link
            key={key++}
            href={`/account/${company.id}`}
            className="font-semibold text-foreground underline decoration-gtse-orange/40 decoration-2 underline-offset-2 hover:decoration-gtse-orange"
          >
            {inner}
          </Link>,
        );
      } else {
        out.push(<strong key={key++} className="font-semibold text-foreground">{inner}</strong>);
      }
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

export function InsightBanner({
  bodyMarkdown, generatedAt, dataSnapshotSummary, className, insightType, region,
}: Props) {
  const [overrideBody, setOverrideBody] = React.useState<string | null>(null);
  const [overrideAt, setOverrideAt] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "streaming" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const canRegenerate = Boolean(insightType && region);
  const displayBody = overrideBody ?? bodyMarkdown;
  const displayAt = overrideAt ?? generatedAt;
  const paragraphs = displayBody.split(/\n\n+/);

  async function regenerate() {
    if (!canRegenerate || status === "streaming") return;
    setStatus("streaming");
    setErrorMsg(null);
    setOverrideBody("");
    try {
      const res = await fetch("/api/insights/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightType, region }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
        const msg = data.hint
          ? `${data.error ?? "Error"}: ${data.hint}`
          : data.error ?? `Request failed (${res.status})`;
        setErrorMsg(msg);
        setStatus("error");
        setOverrideBody(null);
        return;
      }
      if (!res.body) {
        setErrorMsg("Empty response");
        setStatus("error");
        setOverrideBody(null);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOverrideBody(acc);
      }
      setOverrideAt(new Date().toISOString());
      setStatus("idle");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
      setOverrideBody(null);
    }
  }

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
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-[0.12em] text-gtse-orange">AI insight</span>
              <span className="text-muted-foreground">• Generated {fmtTime(displayAt)}</span>
              {overrideBody !== null && status !== "streaming" ? (
                <span className="rounded-sm bg-gtse-orange/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gtse-orange">Live</span>
              ) : null}
            </div>
            {canRegenerate ? (
              <button
                type="button"
                onClick={regenerate}
                disabled={status === "streaming"}
                className="inline-flex items-center gap-1.5 rounded-sm border border-gtse-orange/30 bg-background px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-foreground/80 hover:border-gtse-orange hover:text-foreground disabled:opacity-60"
                title="Regenerate this insight against the latest data"
              >
                {status === "streaming" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {status === "streaming" ? "Regenerating…" : "Regenerate"}
              </button>
            ) : null}
          </div>
          {status === "error" && errorMsg ? (
            <div className="mb-2 mt-1 inline-flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : null}
          <div className="space-y-2 text-[15px] leading-relaxed text-foreground/90">
            {paragraphs.length === 0 || (paragraphs.length === 1 && paragraphs[0] === "") ? (
              status === "streaming" ? (
                <p className="text-muted-foreground">Generating…</p>
              ) : null
            ) : (
              paragraphs.map((p, idx) => (
                <p key={idx}>{renderInline(p)}</p>
              ))
            )}
          </div>
          <p className="mt-3 text-xs italic text-muted-foreground">{dataSnapshotSummary}</p>
        </div>
      </div>
    </section>
  );
}
