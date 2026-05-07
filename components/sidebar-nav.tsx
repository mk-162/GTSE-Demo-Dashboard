"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun, BarChart3, Crown, AlertTriangle, RefreshCw, Layers,
  HeartPulse, Network, Boxes, Sparkles, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Sun };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/", label: "Action queue", icon: Sun },
      { href: "/reorder", label: "Reorder feed", icon: RefreshCw },
      { href: "/lapsed", label: "Lapsed", icon: AlertTriangle },
      { href: "/whales", label: "Whales", icon: Crown },
      { href: "/health", label: "Health score", icon: HeartPulse },
      { href: "/crosssell", label: "Cross-sell", icon: Network },
    ],
  },
  {
    label: "Build a list",
    items: [
      { href: "/targets", label: "Target builder", icon: Target },
      { href: "/segments", label: "Segments", icon: Boxes },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/insights", label: "Insights hub", icon: Sparkles },
      { href: "/rfm", label: "RFM", icon: Layers },
      { href: "/kpis", label: "KPIs", icon: BarChart3 },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4 px-2">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="space-y-0.5">
          <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {group.label}
          </div>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/"
              ? pathname === "/" || pathname?.startsWith("/account")
              : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/8 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm transition-colors",
                    active ? "bg-gtse-orange" : "bg-transparent group-hover:bg-white/20",
                  )}
                />
                <Icon className={cn("h-4 w-4", active ? "text-gtse-orange" : "text-white/60 group-hover:text-white")} />
                <span className="tracking-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
