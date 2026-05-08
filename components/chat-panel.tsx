"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Send, Sparkles, X, Loader2, Trash2, AlertTriangle, Copy, Check, Maximize2, Minimize2,
  TrendingUp, Phone, Target, Boxes, BarChart3, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/components/region-context";
import { MessageMarkdown } from "@/components/message-markdown";
import { cn } from "@/lib/utils";

const SUGGESTIONS: { icon: typeof Phone; text: string; category: string }[] = [
  { icon: Phone, category: "Call list", text: "Give me 5 high-value lapsed accounts to call this week." },
  { icon: TrendingUp, category: "Whales at risk", text: "Which whales lost the most revenue this quarter?" },
  { icon: Target, category: "Account drill-in", text: "Tell me about Sheffield Steelworks — should I be worried?" },
  { icon: BarChart3, category: "KPI question", text: "What's our customer concentration risk in the UK?" },
  { icon: Boxes, category: "Segment query", text: "Which industries are slipping fastest?" },
  { icon: Zap, category: "Cross-sell", text: "Suggest 5 cross-sell opportunities I can act on this week." },
];

const STORAGE_KEY = "whale.chat.messages";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChatPanel({ open, onClose }: Props) {
  const { region } = useRegion();
  const [input, setInput] = React.useState("");
  const [wide, setWide] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Restore prior messages from sessionStorage so the conversation survives toggling.
  const initialMessages = React.useMemo<UIMessage[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UIMessage[]) : [];
    } catch {
      return [];
    }
  }, []);

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

  const { messages, sendMessage, status, error, setMessages, stop, regenerate } = useChat({
    transport,
    messages: initialMessages,
  });

  // Persist messages whenever they change.
  React.useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  // Auto-scroll
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  // Focus input on open
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc closes
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

  function clearChat() {
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
  const errorIs503 = error?.message?.toLowerCase().includes("ai not configured");

  return (
    <>
      {/* Backdrop on mobile + when wide */}
      {open ? (
        <button
          aria-label="Close chat"
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-40 bg-black/30 backdrop-blur-sm",
            wide ? "" : "md:hidden",
          )}
        />
      ) : null}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen flex-col border-l bg-background shadow-2xl transition-all duration-200",
          wide ? "w-full max-w-4xl" : "w-full max-w-md",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-gtse-orange text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold leading-tight">gBot</div>
              <div className="text-[11px] text-muted-foreground">
                {region} customer base · Claude Sonnet 4.6
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {hasMessages ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                title="New chat"
                className="h-8 w-8"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWide(!wide)}
              title={wide ? "Collapse" : "Expand"}
              className="h-8 w-8"
            >
              {wide ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="h-[3px] bg-gtse-orange" />

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <Empty
              wide={wide}
              onPick={(t) => {
                setInput(t);
                inputRef.current?.focus();
              }}
            />
          ) : (
            <div className={cn("mx-auto space-y-5 px-4 py-5", wide ? "max-w-3xl" : "")}>
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  message={m}
                  isStreaming={status === "streaming" && i === messages.length - 1 && m.role === "assistant"}
                  onRegenerate={
                    m.role === "assistant" && i === messages.length - 1 && status !== "streaming"
                      ? () => regenerate()
                      : undefined
                  }
                />
              ))}
              {status === "submitted" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              ) : null}
            </div>
          )}

          {error ? (
            <div className="mx-4 mb-3 mt-1 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
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
          <div className={cn("mx-auto flex items-end gap-2", wide ? "max-w-3xl" : "")}>
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
          <div className={cn("mx-auto mt-1.5 flex justify-between text-[10px] text-muted-foreground", wide ? "max-w-3xl" : "")}>
            <span>Enter to send · Shift+Enter for newline · Esc to close</span>
            <span className="hidden md:inline">All data is mocked · responses generated by Claude</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function Empty({ wide, onPick }: { wide: boolean; onPick: (t: string) => void }) {
  return (
    <div className={cn("mx-auto px-4 py-8", wide ? "max-w-3xl" : "")}>
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-gtse-orange/10 text-gtse-orange">
          <Sparkles className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold tracking-tight">
          Ask anything about the customer base.
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Specific accounts, segment slices, recommendations, or cross-system questions.
        </p>
      </div>
      <div className="mt-6 space-y-2">
        <div className="gtse-eyebrow text-muted-foreground">Try one of these</div>
        <div className={cn("grid gap-2", wide ? "sm:grid-cols-2" : "grid-cols-1")}>
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.text}
                onClick={() => onPick(s.text)}
                className="group flex items-start gap-2.5 rounded-sm border bg-background p-3 text-left transition-all hover:border-gtse-orange hover:shadow-sm"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gtse-teal text-white transition-colors group-hover:bg-gtse-orange">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1">
                  <div className="gtse-eyebrow text-muted-foreground">{s.category}</div>
                  <div className="mt-0.5 text-sm">{s.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Message({
  message, isStreaming, onRegenerate,
}: {
  message: UIMessage;
  isStreaming: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-sm bg-gtse-teal px-3.5 py-2.5 text-sm text-white">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-gtse-orange text-white">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="rounded-sm border bg-card px-4 py-3">
          <MessageMarkdown text={text} />
          {isStreaming ? (
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-gtse-orange align-baseline" aria-hidden />
          ) : null}
        </div>
        {!isStreaming && text.length > 0 ? (
          <div className="mt-1 flex items-center gap-1">
            <CopyButton text={text} />
            {onRegenerate ? (
              <button
                onClick={onRegenerate}
                className="rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Regenerate this answer"
              >
                Regenerate
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
