import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { CHAT_SYSTEM_PROMPT, buildDataContext } from "@/lib/ai-context";

// Edge runtime so streaming works smoothly on Vercel.
export const runtime = "edge";
export const maxDuration = 30;

type ChatRequest = {
  messages: UIMessage[];
  region?: "UK" | "US";
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

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const region = body.region === "US" ? "US" : "UK";
  const messages = body.messages ?? [];

  const dataContext = await buildDataContext(region);

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: `${CHAT_SYSTEM_PROMPT}

The user is currently looking at the ${region} customer base. Here is the relevant data context:

${dataContext}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1200,
    temperature: 0.4,
  });

  return result.toUIMessageStreamResponse();
}
