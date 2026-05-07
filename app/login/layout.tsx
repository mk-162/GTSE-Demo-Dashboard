import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — GTSE",
  description: "Internal demo dashboard for GTSE.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
