"use client";

import * as React from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Send, Sparkles, X, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/components/region-context";
import { companyByName } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Which whales lost the most revenue this quarter?",
  "Give me a call list of high-value lapsed accounts.",
  "Tell me about Sheffield Steelworks — should I be worried?",
  "What's our customer concentration risk?",
  "Which industries are slipping fastest?",
  "Suggest 5 cross-sell opportunities I can act on this week.",
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChatPanel({ open, onClose }: Props) {
  const { region } = useRegion();
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // The transport sends our region alongside the messages.
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { messages, region, ...body },
        }),
      }),
    [region],
  );

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport,
  });

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Focus input on open
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function submit() {
    const t = input.trim();
    if (!t || status === "submitted" || status === "streaming") return;
    sendMessage({ text: t });
    setInput("");
  }

  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
  const errorIs503 = error?.message?.toLowerCase().includes("ai not configured");

  return (
    <>
      {/* Backdrop */}
      {open ? (
        <button
          aria-label="Close chat"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
        />
      ) : null}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-full max-w-md flex-col border-l bg-background shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-gtse-orange text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold">Ask Whale</div>
              <div className="text-[11px] text-muted-foreground">
                {region} customer base · powered by Claude
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasMessages ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMessages([])}
                title="New chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-[3px] bg-gtse-orange" />

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {!hasMessages ? (
            <Empty
              onPick={(t) => {
                setInput(t);
                inputRef.current?.focus();
              }}
            />
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
              {status === "submitted" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mt-3 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <div>
                  {errorIs503 ? (
                    <>
                      <strong>AI not configured.</strong> Set <code>ANTHROPIC_API_KEY</code> in Vercel project settings, then redeploy.
                    </>
                  ) : (
                    <>
                      <strong>Something went wrong.</strong> {error.message}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Input */}
        <div className="border-t bg-card p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask anything about the customer base…"
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-sm border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gtse-orange disabled:opacity-50"
              disabled={isBusy}
            />
            {isBusy ? (
              <Button onClick={() => stop()} variant="outline" size="icon" title="Stop">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={!input.trim()}
                size="icon"
                className="bg-gtse-orange hover:bg-gtse-orange-dark"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline · Esc to close
          </div>
        </div>
      </aside>
    </>
  );
}

function Empty({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-sm bg-gtse-orange/10 text-gtse-orange">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-semibold">Ask anything about the customer base.</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Specific accounts, segment slices, recommendations, or cross-system questions.
        </p>
      </div>
      <div className="space-y-2">
        <div className="gtse-eyebrow text-muted-foreground">Try one of these</div>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full rounded-sm border bg-background px-3 py-2 text-left text-sm hover:border-gtse-orange hover:bg-accent/40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-sm bg-gtse-teal px-3 py-2 text-sm text-white">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-gtse-orange text-white">
        <Sparkles className="h-3 w-3" />
      </span>
      <div className="flex-1 space-y-1.5 text-sm leading-relaxed">
        {renderMarkdown(text)}
      </div>
    </div>
  );
}

// Tiny markdown renderer: paragraphs, **bold** (auto-links to /account if name matches),
// *italic*, [text](href) links, and bullet lists.
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const blocks = text.split(/\n\n+/).filter((b) => b.trim().length > 0);
  return blocks.map((block, i) => <Block key={i} text={block.trim()} />);
}

function Block({ text }: { text: string }) {
  const lines = text.split(/\n/);
  // Detect bullet list (lines starting with "- " or "* ")
  const bulletLines = lines.filter((l) => /^\s*[-*]\s+/.test(l));
  if (bulletLines.length >= 2 && bulletLines.length === lines.length) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {bulletLines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  // Detect numbered list
  const numLines = lines.filter((l) => /^\s*\d+\.\s+/.test(l));
  if (numLines.length >= 2 && numLines.length === lines.length) {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {numLines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*\d+\.\s+/, ""))}</li>
        ))}
      </ol>
    );
  }
  return <p>{renderInline(text)}</p>;
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    // [text](url)
    if (text[i] === "[") {
      const close = text.indexOf("]", i + 1);
      const open = close >= 0 ? text.indexOf("(", close) : -1;
      const end = open >= 0 ? text.indexOf(")", open) : -1;
      if (close > 0 && open === close + 1 && end > open) {
        const label = text.slice(i + 1, close);
        const href = text.slice(open + 1, end);
        out.push(
          <Link
            key={key++}
            href={href}
            className="text-gtse-orange underline decoration-gtse-orange/40 underline-offset-2 hover:decoration-gtse-orange"
          >
            {label}
          </Link>,
        );
        i = end + 1;
        continue;
      }
    }
    // **bold**
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end >= 0) {
        const inner = text.slice(i + 2, end);
        const company = companyByName(inner);
        out.push(
          company ? (
            <Link
              key={key++}
              href={`/account/${company.id}`}
              className="font-semibold text-foreground underline decoration-gtse-orange/40 underline-offset-2 hover:decoration-gtse-orange"
            >
              {inner}
            </Link>
          ) : (
            <strong key={key++} className="font-semibold text-foreground">{inner}</strong>
          ),
        );
        i = end + 2;
        continue;
      }
    }
    // *italic*
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end >= 0 && !text.startsWith("**", end)) {
        out.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    // `code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end >= 0) {
        out.push(
          <code key={key++} className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[11px]">
            {text.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        continue;
      }
    }
    // Plain text up to next markdown char
    const candidates = ["[", "**", "*", "`"]
      .map((c) => text.indexOf(c, i + 1))
      .filter((x) => x > 0);
    const stop = candidates.length > 0 ? Math.min(...candidates) : text.length;
    out.push(text.slice(i, stop));
    i = stop;
  }
  return out;
}
