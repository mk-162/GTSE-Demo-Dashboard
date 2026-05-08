"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { RegionToggle } from "@/components/region-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";

const GTSE_LOGO =
  "https://cdn11.bigcommerce.com/s-v8oj4rfmzr/images/stencil/250x100/gtse_logo_1612977822__44777.original.png";

// Routes that render WITHOUT the dashboard chrome (sidebar + header).
const BARE_ROUTES = new Set(["/login"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = pathname ? BARE_ROUTES.has(pathname) : false;

  const [chatOpen, setChatOpen] = React.useState(false);

  if (isBare) return <>{children}</>;

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — GTSE teal rail */}
      <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col gtse-rail">
        <Link href="/" className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <Image
            src={GTSE_LOGO}
            alt="GTSE"
            width={104}
            height={42}
            unoptimized
            className="h-8 w-auto brightness-0 invert"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Hub</span>
        </Link>
        <div className="border-b border-white/10 px-5 py-3">
          <div className="gtse-eyebrow text-white/60">Project</div>
          <div className="text-base font-semibold text-white">Whale</div>
          <div className="mt-0.5 text-[11px] text-white/60">Customer intelligence</div>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav />
        </div>
        <div className="border-t border-white/10 px-5 py-3 text-[10px] uppercase tracking-wider text-white/45">
          GTSE Ltd · Mock-up v0.1
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Image
                src={GTSE_LOGO}
                alt="GTSE"
                width={104}
                height={42}
                unoptimized
                className="h-7 w-auto"
              />
              <span className="gtse-eyebrow text-foreground/70">Project Whale</span>
            </div>
            <div className="hidden text-xs uppercase tracking-[0.14em] text-muted-foreground lg:block">
              Phase 1 · Understand the data &nbsp;·&nbsp; Phase 2 · Act on segments
            </div>
            <div className="flex items-center gap-2">
              <RegionToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChatOpen(true)}
                className="gap-1.5 border-gtse-orange/30 bg-gtse-orange/5 text-foreground hover:bg-gtse-orange/10"
                title="Ask Whale anything"
              >
                <Sparkles className="h-3.5 w-3.5 text-gtse-orange" />
                <span className="hidden text-xs font-semibold uppercase tracking-wider md:inline">Ask Whale</span>
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="h-[3px] w-full bg-gtse-orange" />
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] p-4 md:p-8">{children}</div>
        </main>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
