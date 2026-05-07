"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, BarChart3, Crown, AlertTriangle, RefreshCw, Layers,
  HeartPulse, Network, Boxes, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/kpis", label: "KPIs", icon: BarChart3 },
  { href: "/whales", label: "Whales", icon: Crown },
  { href: "/lapsed", label: "Lapsed", icon: AlertTriangle },
  { href: "/reorder", label: "Reorder feed", icon: RefreshCw },
  { href: "/rfm", label: "RFM", icon: Layers },
  { href: "/health", label: "Health score", icon: HeartPulse },
  { href: "/crosssell", label: "Cross-sell", icon: Network },
  { href: "/segments", label: "Segments", icon: Boxes },
  { href: "/insights", label: "Insights hub", icon: Sparkles },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
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
    </nav>
  );
}
