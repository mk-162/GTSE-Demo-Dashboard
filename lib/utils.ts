import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, region: "UK" | "US" = "UK"): string {
  const symbol = region === "UK" ? "£" : "$";
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}k`;
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

export function formatCurrencyExact(value: number, region: "UK" | "US" = "UK"): string {
  const symbol = region === "UK" ? "£" : "$";
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}
