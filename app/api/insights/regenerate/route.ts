import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { buildInsightPrompt } from "@/lib/ai-context";

// Edge runtime so streaming works smoothly on Vercel.
export const runtime = "edge";
export const maxDuration = 30;

type RegenerateRequest = {
  insightType: string;
  region: "UK" | "US";
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "AI not configured",
        hint: "Set ANTHROPIC_API_KEY in Vercel project settings.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: RegenerateRequest;
  try {
    body = (await req.json()) as RegenerateRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const region = body.region === "US" ? "US" : "UK";
  const prompts = buildInsightPrompt(body.insightType, region);
  if (!prompts) {
    return new Response(
      JSON.stringify({ error: "unknown insightType", insightType: body.insightType }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: prompts.system,
    prompt: prompts.user,
    maxOutputTokens: 800,
    temperature: 0.5,
  });

  // Plain text stream (not UI-message stream) — the client just appends chunks.
  return result.toTextStreamResponse();
}
