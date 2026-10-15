import { streamAgent } from "@/agent/runtime/run-agent";
import type { AgentStreamEvent } from "@/agent/contracts/types";
import { AgentRequestError, parseAgentRequest, readAgentRequest } from "./request";

export const runtime = "nodejs";

const requestWindows = new Map<string, { count: number; resetsAt: number }>();

function isRateLimited(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const current = requestWindows.get(address);
  if (!current || current.resetsAt <= now) {
    requestWindows.set(address, { count: 1, resetsAt: now + 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  let parsed: ReturnType<typeof parseAgentRequest>;
  try {
    parsed = parseAgentRequest(await readAgentRequest(request));
  } catch (error) {
    const failure = error instanceof AgentRequestError ? error : new AgentRequestError("Invalid agent request.");
    return Response.json({ error: failure.message }, { status: failure.status });
  }
  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of streamAgent(parsed.messages, parsed.currentView)) send(event);
      } catch {
        // Upstream errors may echo submitted image data; keep server logs payload-free.
        console.error("[Agent] Request failed");
        send({ type: "error", message: "The guide is temporarily unavailable." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(bodyStream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
