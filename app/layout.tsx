import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { RegionProvider } from "@/components/region-context";
import { AppShell } from "@/components/app-shell";
import { resolveRegion } from "@/lib/region";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Project Whale — GTSE Hub",
  description: "Customer database intelligence for UK and US — Project Whale mock-up dashboard.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialRegion = await resolveRegion();
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <RegionProvider initialRegion={initialRegion}>
            <AppShell>{children}</AppShell>
          </RegionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
