"use client";

import * as React from "react";
import {
  Plug, Code2, Database, Sparkles, CheckCircle2, AlertTriangle, Loader2,
  ExternalLink, Eye, EyeOff, KeyRound, Shield, Zap, ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyBlock } from "@/components/copy-block";

// In a real implementation this would be a per-user API token. For the demo
// we use the same value as the dashboard password (set via WHALE_PASSWORD or
// WHALE_API_TOKEN env var; falls back to the demo string client-side).
const DEMO_TOKEN_HINT = "gtse2026";

export default function SettingsPage() {
  const [origin, setOrigin] = React.useState("https://gtse-demo-dashboard.vercel.app");

  React.useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  return (
    <PageShell
      title="Settings"
      subtitle="Connect your own AI agent (Claude Cowork, Claude Code, ChatGPT, custom) to the same data the dashboard uses."
    >
      {/* Why this matters — the architecture pitch */}
      <Card className="border-2 border-gtse-orange/30 bg-gtse-orange/5">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-gtse-orange text-white">
              <Zap className="h-5 w-5" />
            </span>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Why connect your AI here, not direct to HubSpot</h2>
              <p className="text-sm text-foreground/80">
                Connecting Claude Cowork (or any AI agent) to HubSpot directly forces the agent to read raw records — thousands of contact, deal, and engagement objects per question. That burns tokens fast and frequently fails with context-window errors past a few thousand customers.
              </p>
              <p className="text-sm text-foreground/80">
                <strong>This dashboard's API exposes pre-aggregated data.</strong> A "show me the top-50 UK whales" query reads ~50 rows of clean, summarised data — not 50,000 raw records. Same answers, fraction of the cost, no context-window failures.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Three connection options as tabs */}
      <Tabs defaultValue="mcp" className="w-full">
        <TabsList className="h-auto w-full justify-start rounded-sm bg-muted p-1">
          <TabsTrigger value="mcp" className="gap-2">
            <Plug className="h-3.5 w-3.5" /> MCP server
            <Badge variant="green" className="ml-1 text-[10px]">recommended</Badge>
          </TabsTrigger>
          <TabsTrigger value="rest" className="gap-2">
            <Code2 className="h-3.5 w-3.5" /> REST API
          </TabsTrigger>
          <TabsTrigger value="db" className="gap-2">
            <Database className="h-3.5 w-3.5" /> Direct database
          </TabsTrigger>
        </TabsList>

        {/* MCP */}
        <TabsContent value="mcp" className="mt-4 space-y-4">
          <McpPanel origin={origin} />
        </TabsContent>

        {/* REST */}
        <TabsContent value="rest" className="mt-4 space-y-4">
          <RestPanel origin={origin} />
        </TabsContent>

        {/* Direct DB */}
        <TabsContent value="db" className="mt-4 space-y-4">
          <DbPanel />
        </TabsContent>
      </Tabs>

      {/* Auth + security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" /> Authentication & security
          </CardTitle>
          <CardDescription>
            All connection methods authenticate via a single Bearer token. Don't share it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ApiTokenRow tokenHint={DEMO_TOKEN_HINT} />
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>API tokens are validated server-side. Bad tokens return <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px]">401 Unauthorized</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>Each endpoint is read-only. No write surface today.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>CORS is open for the demo so any tool can call from any origin. Lock down to specific origins in production.</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>For a wider rollout: rotate to per-user tokens, add per-IP rate limits, and enforce tenant scoping on each request.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Discoverability + test */}
      <Card>
        <CardHeader>
          <CardTitle>Test the connection</CardTitle>
          <CardDescription>
            Verify your setup with a single round-trip. Any 200 response means the connection is live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestRunner origin={origin} />
        </CardContent>
      </Card>
    </PageShell>
  );
}

function McpPanel({ origin }: { origin: string }) {
  const mcpUrl = `${origin}/mcp`;
  const claudeCodeJson = `{
  "mcpServers": {
    "project-whale": {
      "url": "${mcpUrl}",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN"
      }
    }
  }
}`;

  const tools = [
    { name: "list_companies", desc: "Filter the customer base by region, industry, RFM, health, lapse ratio, owner, etc." },
    { name: "get_account", desc: "Full per-account drill-in: orders, signals, recommendation, owner, predicted next order." },
    { name: "get_kpis", desc: "Headline KPIs + 12-month revenue trend per region." },
    { name: "get_segments", desc: "Phase-2 segment memberships with company IDs you can drill into." },
    { name: "get_insights", desc: "Latest AI-generated insight prose for one region or insight type." },
    { name: "get_top_whales", desc: "Top-N accounts by LTM revenue, with lapse ratio + health." },
    { name: "get_lapsed", desc: "Lapsed and/or slipping accounts ranked by lifetime revenue." },
    { name: "get_reorder_due", desc: "Predicted reorder feed — overdue + upcoming with expected order value." },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-gtse-orange" /> Connect via MCP
          </CardTitle>
          <CardDescription>
            The recommended path for Claude Cowork, Claude Code, Cursor, or any tool that speaks the
            Model Context Protocol. The agent gets a typed list of tools it can call rather than reading raw records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Step number={1} title="Copy the server URL">
              <CopyBlock value={mcpUrl} language="MCP server URL" />
            </Step>
            <Step number={2} title="Add to your AI agent">
              In Claude Cowork / Claude Code, open <strong>Settings → MCP servers → Add custom</strong>. Paste the URL, then add an Authorization header with your API token.
            </Step>
            <Step number={3} title="Test">
              Ask the agent <em>"List the top 10 UK whales"</em>. If the tool call succeeds, you're connected.
            </Step>
          </div>

          <div>
            <div className="gtse-eyebrow mb-2 text-muted-foreground">Claude Code config snippet</div>
            <CopyBlock value={claudeCodeJson} language="~/.claude/mcp.json" />
            <p className="mt-1 text-xs text-muted-foreground">
              Replace <code className="rounded-sm bg-muted px-1 py-0.5">YOUR_API_TOKEN</code> with the value from the Authentication section below.
            </p>
          </div>

          <div className="rounded-sm border-l-4 border-l-amber-500 bg-amber-500/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div>
                <strong>Status: documented, ready to ship.</strong> The MCP server is built into the architecture but not yet exposed on this demo URL — the REST API tab below has the same data live today. The MCP wrapper is a Phase 1 deliverable (~2 days of work to wire the eight tools to the existing data layer).
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tools the MCP server exposes</CardTitle>
          <CardDescription>
            Each tool returns JSON. The agent picks the right one based on the question — no raw records ever flow into the LLM context.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y">
            {tools.map((t) => (
              <li key={t.name} className="flex items-start gap-3 px-6 py-2.5">
                <code className="mt-0.5 shrink-0 rounded-sm bg-gtse-teal/10 px-1.5 py-0.5 font-mono text-[11px] text-gtse-teal">
                  {t.name}
                </code>
                <span className="text-sm text-muted-foreground">{t.desc}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function RestPanel({ origin }: { origin: string }) {
  const apiBase = `${origin}/api/v1`;
  const curlExample = `curl -H "Authorization: Bearer YOUR_API_TOKEN" \\
  "${apiBase}/top-whales?region=UK&n=10"`;
  const fetchExample = `// Node, Bun, browser — anywhere fetch is available
const res = await fetch("${apiBase}/companies?region=UK&healthBands=red&lapseRatioMin=2.0", {
  headers: { Authorization: \`Bearer \${process.env.WHALE_API_TOKEN}\` },
});
const data = await res.json();
console.log(\`\${data.total} matching accounts\`);`;
  const pythonExample = `import os, requests

token = os.environ["WHALE_API_TOKEN"]
headers = {"Authorization": f"Bearer {token}"}
res = requests.get(
    "${apiBase}/companies",
    headers=headers,
    params={"region": "UK", "healthBands": "red", "lapseRatioMin": "2.0"},
)
data = res.json()
print(f"{data['total']} matching accounts")`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-gtse-orange" /> Connect via REST API
          </CardTitle>
          <CardDescription>
            Live today. Use this for ChatGPT custom connectors, Zapier, n8n, custom dashboards, or any
            tool that speaks HTTP. Same data as the MCP server, plain JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="gtse-eyebrow mb-2 text-muted-foreground">Base URL</div>
            <CopyBlock value={apiBase} />
          </div>

          <div>
            <div className="gtse-eyebrow mb-2 text-muted-foreground">curl</div>
            <CopyBlock value={curlExample} language="bash" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="gtse-eyebrow mb-2 text-muted-foreground">JavaScript / TypeScript</div>
              <CopyBlock value={fetchExample} language="ts" />
            </div>
            <div>
              <div className="gtse-eyebrow mb-2 text-muted-foreground">Python</div>
              <CopyBlock value={pythonExample} language="python" />
            </div>
          </div>

          <div className="rounded-sm border bg-card p-3 text-sm">
            <div className="gtse-eyebrow mb-2 text-muted-foreground">Discoverability endpoint</div>
            <p className="text-muted-foreground">
              <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px]">GET {apiBase}</code>{" "}
              returns the full endpoint list with parameter docs — no auth required for the discovery itself.
            </p>
            <Button asChild variant="link" className="mt-1 h-auto px-0 text-xs text-gtse-orange">
              <a href={apiBase} target="_blank" rel="noopener noreferrer">
                View endpoint catalogue <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available endpoints</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y text-sm">
            <Endpoint method="GET" path="/api/v1" desc="Discoverability — list all endpoints + auth + examples" />
            <Endpoint method="GET" path="/api/v1/companies" desc="Filter the customer base (Target builder schema)" />
            <Endpoint method="GET" path="/api/v1/companies/{id}" desc="Full account detail + orders + monthly trend" />
            <Endpoint method="GET" path="/api/v1/kpis" desc="Headline KPIs + 12-month trend per region" />
            <Endpoint method="GET" path="/api/v1/segments" desc="Phase-2 segment memberships" />
            <Endpoint method="GET" path="/api/v1/insights" desc="Latest AI-generated insight prose" />
            <Endpoint method="GET" path="/api/v1/top-whales" desc="Top-N accounts by LTM revenue" />
            <Endpoint method="GET" path="/api/v1/lapsed" desc="Lapsed + slipping accounts ranked by lifetime value" />
            <Endpoint method="GET" path="/api/v1/reorder-due" desc="Predicted reorder feed" />
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function DbPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gtse-orange" /> Direct database access
        </CardTitle>
        <CardDescription>
          For developers building custom dashboards, dbt models, or BI tools. Connect any Postgres
          client (Metabase, Lightdash, DataGrip, dbt) directly to the warehouse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-sm border-l-4 border-l-amber-500 bg-amber-500/5 p-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <div>
              <strong>Available once Phase 1 ships.</strong> The current demo data lives in TypeScript modules. When the real warehouse goes live (Vercel Postgres / Neon, populated by nightly Vercel Cron jobs from HubSpot and NetSuite), this is the connection string developers will use.
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="gtse-eyebrow mb-1 text-muted-foreground">Connection example (Phase 1)</div>
            <CopyBlock
              value={`postgresql://reader:••••@host.neon.tech:5432/whale?sslmode=require`}
              language="connection string"
            />
          </div>
          <div>
            <div className="gtse-eyebrow mb-1 text-muted-foreground">Schemas you'll have access to</div>
            <ul className="space-y-1 text-muted-foreground">
              <li><code className="rounded-sm bg-muted px-1 py-0.5 text-[11px]">marts</code> — clean tables consumed by dashboards (mart_whales, mart_lapsed, mart_kpi_overview, etc.)</li>
              <li><code className="rounded-sm bg-muted px-1 py-0.5 text-[11px]">app</code> — generated insights + segment-membership log + suppression list</li>
              <li><em>(staging + intermediate are dbt internals — not exposed by default)</em></li>
            </ul>
          </div>
          <div>
            <div className="gtse-eyebrow mb-1 text-muted-foreground">Recommended tools</div>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong>Metabase</strong> — ad-hoc SQL exploration, dashboards. Open source, free.</li>
              <li><strong>Lightdash</strong> — dbt-native BI. Best if you want Looker-style metric definitions.</li>
              <li><strong>Postgres MCP</strong> — connect Claude Code or Cowork directly to the warehouse for SQL questions.</li>
              <li><strong>dbt</strong> — custom transformations on top of the existing models.</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-gtse-teal text-xs font-semibold text-white">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 px-6 py-2.5">
      <span className="mt-0.5 shrink-0 rounded-sm bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
        {method}
      </span>
      <code className="mt-0 shrink-0 font-mono text-[12px] text-foreground">{path}</code>
      <span className="text-muted-foreground">— {desc}</span>
    </li>
  );
}

function ApiTokenRow({ tokenHint }: { tokenHint: string }) {
  const [revealed, setRevealed] = React.useState(false);
  return (
    <div className="rounded-sm border bg-card p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gtse-orange" />
          <div>
            <div className="text-sm font-semibold">Demo API token</div>
            <div className="text-xs text-muted-foreground">
              In production: rotate to per-user tokens stored as <code className="rounded-sm bg-muted px-1 py-0.5 text-[11px]">WHALE_API_TOKEN</code> on Vercel.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded-sm border bg-background px-2.5 py-1 font-mono text-[12px]">
            {revealed ? tokenHint : "••••••••"}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevealed(!revealed)}
            className="gap-1.5"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? "Hide" : "Reveal"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type TestResult =
  | { state: "idle" }
  | { state: "running" }
  | { state: "ok"; statusCode: number; latencyMs: number; sample: string }
  | { state: "fail"; statusCode: number; message: string };

function TestRunner({ origin }: { origin: string }) {
  const [token, setToken] = React.useState(DEMO_TOKEN_HINT);
  const [result, setResult] = React.useState<TestResult>({ state: "idle" });

  async function run() {
    setResult({ state: "running" });
    const start = performance.now();
    try {
      const res = await fetch(`${origin}/api/v1/top-whales?region=UK&n=3`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        const text = await res.text();
        setResult({ state: "fail", statusCode: res.status, message: text.slice(0, 300) });
        return;
      }
      const data = (await res.json()) as { whales: { name: string; ltm_revenue: number }[] };
      const sample = data.whales
        .slice(0, 3)
        .map((w) => `${w.name} — £${(w.ltm_revenue / 1000).toFixed(0)}k LTM`)
        .join("\n");
      setResult({ state: "ok", statusCode: res.status, latencyMs, sample });
    } catch (e) {
      setResult({
        state: "fail",
        statusCode: 0,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="flex-1 space-y-1">
          <div className="text-xs font-medium">API token</div>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bearer token"
            className="h-9 w-full rounded-sm border border-input bg-background px-3 font-mono text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button onClick={run} disabled={result.state === "running"} className="bg-gtse-orange hover:bg-gtse-orange-dark">
          {result.state === "running" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Test connection
            </>
          )}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Hits <code className="rounded-sm bg-muted px-1 py-0.5">GET /api/v1/top-whales?region=UK&n=3</code>
      </div>

      {result.state === "ok" ? (
        <div className="rounded-sm border-l-4 border-l-emerald-500 bg-emerald-500/5 p-3">
          <div className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="space-y-1">
              <div className="font-semibold">Connection live · HTTP {result.statusCode} · {result.latencyMs}ms</div>
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{result.sample}</pre>
            </div>
          </div>
        </div>
      ) : null}

      {result.state === "fail" ? (
        <div className="rounded-sm border-l-4 border-l-destructive bg-destructive/5 p-3">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-1">
              <div className="font-semibold text-destructive">Connection failed{result.statusCode > 0 ? ` · HTTP ${result.statusCode}` : ""}</div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-destructive/80">{result.message || "(no detail)"}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
