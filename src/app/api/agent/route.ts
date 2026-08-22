import { streamAgent } from "@/agent/run-agent";
import { MAP_DESTINATIONS, type AgentMessage, type AgentStreamEvent, type MapDestination } from "@/agent/types";

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

function parseRequest(value: unknown): { messages: AgentMessage[]; currentView: MapDestination } | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) return null;
  if (typeof body.currentView !== "string" || !MAP_DESTINATIONS.includes(body.currentView as MapDestination)) return null;
  const messages: AgentMessage[] = [];
  for (const candidate of body.messages) {
    if (typeof candidate !== "object" || candidate === null) return null;
    const message = candidate as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return null;
    const content = message.content.trim();
    if (!content || content.length > 4_000) return null;
    messages.push({ role: message.role, content });
  }
  if (messages.at(-1)?.role !== "user") return null;
  if (messages.reduce((total, message) => total + message.content.length, 0) > 20_000) return null;
  return { messages, currentView: body.currentView as MapDestination };
}

export async function POST(request: Request) {
  if (isRateLimited(request)) return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = parseRequest(body);
  if (!parsed) return Response.json({ error: "Invalid agent request." }, { status: 400 });
  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of streamAgent(parsed.messages, parsed.currentView)) send(event);
      } catch (error) {
        console.error("[Agent] Request failed", error instanceof Error ? error.message : "Unknown error");
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
