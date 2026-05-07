import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { RegionProvider } from "@/components/region-context";
import { SidebarNav } from "@/components/sidebar-nav";
import { RegionToggle } from "@/components/region-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const GTSE_LOGO =
  "https://cdn11.bigcommerce.com/s-v8oj4rfmzr/images/stencil/250x100/gtse_logo_1612977822__44777.original.png";

export const metadata: Metadata = {
  title: "Project Whale — GTSE Hub",
  description: "Customer database intelligence for UK and US — Project Whale mock-up dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RegionProvider>
            <div className="flex min-h-screen">
              {/* Sidebar — GTSE teal rail */}
              <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col gtse-rail">
                <Link
                  href="/"
                  className="flex h-16 items-center gap-3 border-b border-white/10 px-5"
                >
                  <Image
                    src={GTSE_LOGO}
                    alt="GTSE"
                    width={104}
                    height={42}
                    unoptimized
                    className="h-8 w-auto brightness-0 invert"
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                    Hub
                  </span>
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
                    <div className="flex items-center gap-3">
                      <RegionToggle />
                      <ThemeToggle />
                    </div>
                  </div>
                  {/* GTSE orange accent stripe */}
                  <div className="h-[3px] w-full bg-gtse-orange" />
                </header>
                <main className="flex-1 overflow-x-hidden">
                  <div className="mx-auto w-full max-w-[1400px] p-4 md:p-8">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </RegionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
