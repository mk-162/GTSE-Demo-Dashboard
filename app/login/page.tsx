"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const GTSE_LOGO =
  "https://cdn11.bigcommerce.com/s-v8oj4rfmzr/images/stencil/250x100/gtse_logo_1612977822__44777.original.png";

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginShell />}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="absolute inset-x-0 top-0">
        <div className="h-2 bg-gtse-teal" />
        <div className="h-[3px] bg-gtse-orange" />
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/";

  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("That password isn't right.");
        setSubmitting(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <LoginShell>
      <Card className="border-2">
        <CardContent className="space-y-6 p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src={GTSE_LOGO}
              alt="GTSE"
              width={140}
              height={56}
              unoptimized
              className="h-10 w-auto"
            />
            <h1 className="text-2xl font-semibold tracking-tight">Customer intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Internal demo dashboard. Enter the access password to continue.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="password" className="gtse-eyebrow text-foreground/80">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 w-full rounded-sm border border-input bg-background pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gtse-orange"
                  placeholder="Enter password"
                  disabled={submitting}
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || password.length === 0}
              className="w-full bg-gtse-orange uppercase tracking-wider hover:bg-gtse-orange-dark"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Signing in
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            Mock-up · All data is fake · GTSE Ltd
          </p>
        </CardContent>
      </Card>
    </LoginShell>
  );
}
