"use client";

import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  className?: string;
  /**
   * Lower-cased company name → company id. When provided, **bold** spans whose
   * lower-cased text matches a key auto-linkify to /account/[id]. When absent,
   * **bold** renders as plain text.
   */
  nameToIdMap?: Record<string, string>;
};

const NameMapContext = React.createContext<Record<string, string> | undefined>(undefined);

/**
 * Markdown renderer used by both the chat panel and the AI insight banners.
 *
 * Special behaviour:
 *   - **Bold** spans matching a known company name auto-linkify to /account/[id].
 *   - Internal links (starting with /) use Next.js <Link> for client navigation.
 *   - External links open in a new tab.
 *   - Tables, lists, code blocks all get GTSE-branded styling.
 */
export function MessageMarkdown({ text, className, nameToIdMap }: Props) {
  return (
    <NameMapContext.Provider value={nameToIdMap}>
      <div
        className={cn(
          "prose-message space-y-3 text-[15px] leading-relaxed text-foreground/90",
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className,
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="leading-relaxed">{children}</p>,
            h1: ({ children }) => <h2 className="mt-3 text-base font-semibold tracking-tight">{children}</h2>,
            h2: ({ children }) => <h2 className="mt-3 text-base font-semibold tracking-tight">{children}</h2>,
            h3: ({ children }) => <h3 className="mt-3 text-sm font-semibold tracking-tight">{children}</h3>,
            h4: ({ children }) => <h4 className="mt-2 text-sm font-semibold">{children}</h4>,
            strong: ({ children }) => <BoldOrCompany>{children}</BoldOrCompany>,
            em: ({ children }) => <em className="italic">{children}</em>,
            a: ({ href, children }) => <SmartLink href={href}>{children}</SmartLink>,
            ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            hr: () => <hr className="my-3 border-border" />,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-gtse-orange pl-3 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            code: ({ className, children }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[12px]">
                    {children}
                  </code>
                );
              }
              return (
                <code className="block overflow-x-auto rounded-sm bg-muted p-3 font-mono text-[12px]">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
            table: ({ children }) => (
              <div className="my-2 overflow-x-auto rounded-sm border">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-gtse-teal text-white">{children}</thead>,
            th: ({ children }) => (
              <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider">
                {children}
              </th>
            ),
            td: ({ children }) => <td className="border-t px-2.5 py-1.5 align-top">{children}</td>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </NameMapContext.Provider>
  );
}

function getString(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getString).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getString(node.props.children);
  }
  return "";
}

function BoldOrCompany({ children }: { children: React.ReactNode }) {
  const map = React.useContext(NameMapContext);
  const text = getString(children);
  const id = map ? map[text.toLowerCase().trim()] : undefined;
  if (!id) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  }
  return (
    <Link
      href={`/account/${id}`}
      className="font-semibold text-foreground underline decoration-gtse-orange/40 decoration-2 underline-offset-2 transition-colors hover:decoration-gtse-orange"
    >
      {children}
    </Link>
  );
}

function SmartLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <>{children}</>;

  // Internal route — use Next.js Link
  if (href.startsWith("/")) {
    return (
      <Link
        href={href}
        className="text-gtse-orange underline decoration-gtse-orange/50 underline-offset-2 hover:decoration-gtse-orange"
      >
        {children}
      </Link>
    );
  }
  // External link
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gtse-orange underline decoration-gtse-orange/50 underline-offset-2 hover:decoration-gtse-orange"
    >
      {children}
    </a>
  );
}
