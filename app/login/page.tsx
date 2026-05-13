"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const GTSE_LOGO =
  "https://cdn11.bigcommerce.com/s-v8oj4rfmzr/images/stencil/250x100/gtse_logo_1612977822__44777.original.png";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Sign-in was interrupted. Please try again.",
  no_code: "HubSpot didn't return an authorization code. Please try again.",
  token_exchange_failed: "Couldn't verify your HubSpot session. Please try again.",
  token_info_failed: "Couldn't read your HubSpot identity. Please try again.",
  wrong_hub_id:
    "Your HubSpot account isn't part of GTSE's portal. If you believe this is wrong, contact Matt.",
  session_create_failed:
    "Sign-in succeeded but we couldn't create your session. Please try again or contact Matt.",
};

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginShell />}>
      <LoginContent />
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

function LoginContent() {
  const search = useSearchParams();
  const from = search.get("from") || "/";
  const errorCode = search.get("error");
  const [signingIn, setSigningIn] = React.useState(false);

  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ??
      (errorCode.startsWith("hubspot_error:")
        ? `HubSpot reported: ${errorCode.slice("hubspot_error:".length)}`
        : "Sign-in failed. Please try again.")
    : null;

  function startSignIn() {
    setSigningIn(true);
    const url = new URL("/api/auth/hubspot/login", window.location.origin);
    url.searchParams.set("from", from);
    window.location.assign(url.toString());
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
              Sign in with your HubSpot account. Only GTSE staff can access this dashboard.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={startSignIn}
            disabled={signingIn}
            className="w-full bg-gtse-orange uppercase tracking-wider hover:bg-gtse-orange-dark"
          >
            {signingIn ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Redirecting to HubSpot…
              </>
            ) : (
              "Sign in with HubSpot"
            )}
          </Button>

          <p className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">
            Authentication via HubSpot OAuth · GTSE Ltd
          </p>
        </CardContent>
      </Card>
    </LoginShell>
  );
}
