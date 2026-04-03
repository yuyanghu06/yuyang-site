import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { tavily } from "@tavily/core";
import { EmbeddingService } from "../mcp/embedding.service";
import { PineconeService  } from "../mcp/pinecone.service";
import { ContextService   } from "../mcp/context.service";

// ── Tavily web search tool definition (OpenAI function-calling schema) ────────
const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name:        "web_search",
    description: "Search the web for current information. Use when the user asks about recent events, live data, or anything that may not be in your training knowledge.",
    parameters: {
      type:       "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
} as const;

// A single message in the conversation thread
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Structured reply returned to the controller — tool call already parsed out
export interface ParsedReply {
  text:   string;
  action: { tool: string; parameters: string[] } | null;
}

/**
 * parseReply
 * ----------
 * Scan the raw model output from the bottom up, find the first line that is a
 * valid JSON tool call, strip it from the text, and return both separately.
 * Exported so the streaming controller can call it after accumulating the full text.
 */
export function parseReply(raw: string): ParsedReply {
  const lines = raw.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    // Strip surrounding quotes the model may add due to prompt example formatting
    const line = lines[i].trim().replace(/^["']|["']$/g, "");
    if (!line.startsWith("{") || !line.endsWith("}")) continue;

    try {
      const parsed = JSON.parse(line) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as Record<string, unknown>).tool === "string" &&
        Array.isArray((parsed as Record<string, unknown>).parameters)
      ) {
        lines.splice(i, 1);
        const text = lines
          .filter((l) => !/^```/.test(l.trim()))
          .join("\n")
          .trim();

        const fallbacks: Record<string, string> = {
          navigate: "On it.",
          redirect: "Here you go.",
          contact:  "Let's get you in touch.",
          message:  "",
        };
        const toolName = (parsed as { tool: string }).tool;
        return {
          text:   text || fallbacks[toolName] || ".",
          action: parsed as { tool: string; parameters: string[] },
        };
      }
    } catch {
      // Not valid JSON — keep scanning upward
    }
  }

  return { text: raw.trim(), action: null };
}

/**
 * sanitizeHistory
 * ---------------
 * Ensures the message array sent to TogetherAI is valid:
 *   1. Strips any leading assistant messages (the UI greeting, contact-flow prompts, etc.)
 *      because the first non-system message must be from the user.
 *   2. Merges consecutive same-role messages so the conversation strictly alternates.
 */
function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  let start = 0;
  while (start < history.length && history[start].role !== "user") start++;
  const trimmed = history.slice(start);
  if (trimmed.length === 0) return [];

  const out: ChatMessage[] = [{ ...trimmed[0] }];
  for (let i = 1; i < trimmed.length; i++) {
    const last = out[out.length - 1];
    if (last.role === trimmed[i].role) {
      last.content += "\n\n" + trimmed[i].content;
    } else {
      out.push({ ...trimmed[i] });
    }
  }
  return out.filter((m) => m.content.trim().length > 0);
}

@Injectable()
export class ChatService {
  private readonly SYSTEM_PROMPT: string = readFileSync(
    join(__dirname, "..", "..", "..", "prompts", "SYSTEM_PROMPT.md"),
    "utf-8",
  ).trim();

  private readonly TOOLS_PROMPT: string = readFileSync(
    join(__dirname, "..", "..", "..", "prompts", "TOOLS.md"),
    "utf-8",
  ).trim();

  private readonly IMAGE_ANALYSIS_PROMPT: string = readFileSync(
    join(__dirname, "..", "..", "..", "prompts", "IMAGE_ANALYSIS_PROMPT.md"),
    "utf-8",
  ).trim();

  constructor(
    private readonly embedding: EmbeddingService,
    private readonly pinecone:  PineconeService,
    private readonly context:   ContextService,
  ) {}

  /**
   * describeImage
   * -------------
   * Sends a base64 data URL to GPT-4o with the IMAGE_ANALYSIS_PROMPT and returns
   * a plain-text description to be injected into the TogetherAI context.
   */
  private async describeImage(dataUrl: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new InternalServerErrorException("OPENAI_API_KEY not configured");

    console.log("[Chat] Sending image to GPT-4o for description…");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      "gpt-4o",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "text",      text: this.IMAGE_ANALYSIS_PROMPT },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Chat] GPT-4o vision error", response.status, err);
      throw new InternalServerErrorException(`OpenAI Vision error ${response.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const description: string = data?.choices?.[0]?.message?.content ?? "";
    console.log("[Chat] Image description from GPT-4o:\n", description);
    return description;
  }

  /**
   * buildMessages
   * -------------
   * Shared helper: runs the RAG pipeline, assembles the enriched system prompt,
   * and returns the final messages array ready to send to TogetherAI.
   */
  private async buildMessages(history: ChatMessage[], imageDescription?: string): Promise<ChatMessage[]> {
    let contextBlock = "";
    try {
      const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const topK        = parseInt(process.env.PINECONE_TOP_K ?? "5", 10);
        const queryVector = await this.embedding.embed(lastUserMsg.content);
        const matches     = await this.pinecone.queryIndex(queryVector, topK);
        contextBlock      = await this.context.buildContext(matches);
      }
    } catch (err) {
      console.warn("[MCP] RAG pipeline failed, falling back to context-free chat:", (err as Error).message);
    }

    const enrichedSystemPrompt = [
      this.SYSTEM_PROMPT,
      this.TOOLS_PROMPT,
      ...(contextBlock ? [contextBlock] : []),
      ...(imageDescription ? [`[IMAGE]\n${imageDescription}\n[/IMAGE]`] : []),
    ].join("\n\n");

    return [
      { role: "system", content: enrichedSystemPrompt },
      ...sanitizeHistory(history),
    ];
  }

  /**
   * chat
   * ----
   * Non-streaming path: waits for the full TogetherAI response, then parses
   * and returns it as a ParsedReply.
   */
  async chat(history: ChatMessage[], image?: string): Promise<ParsedReply> {
    const apiKey = process.env.TOGETHER_API_KEY;
    const model  = process.env.TOGETHER_MODEL;
    if (!apiKey) throw new InternalServerErrorException("TOGETHER_API_KEY not configured");
    if (!model)  throw new InternalServerErrorException("TOGETHER_MODEL not configured");

    const imageDescription = image ? await this.describeImage(image) : undefined;
    const messages = await this.buildMessages(history, imageDescription);
    console.log("[Chat] Sending to TogetherAI — model:", model, "| message roles:", messages.map((m) => m.role));

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.7 }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Chat] TogetherAI returned", response.status, text);
      throw new InternalServerErrorException(`TogetherAI error ${response.status}: ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    console.log("[Chat] Raw reply from TogetherAI:\n", raw);
    const parsed = parseReply(raw.trim());
    console.log("[Chat] Parsed reply — text:", parsed.text, "| action:", parsed.action);
    return parsed;
  }

  /**
   * streamChunks
   * ------------
   * Streaming agentic loop:
   *   1. Sends messages to TogetherAI with stream:true and the web_search tool available.
   *   2. Yields text chunks as they arrive.
   *   3. If the model calls web_search, the stream pauses, Tavily executes the query,
   *      and a { type: "search", query } sentinel is yielded so the controller can
   *      forward a "searching…" event to the client. The result is injected as a
   *      tool message and the loop continues.
   *   4. Repeats until finish_reason is "stop" with no pending tool calls.
   *
   * Sentinel format (not shown to the user — controller strips it before display):
   *   "\x00SEARCH:" + query + "\x00"
   */
  async *streamChunks(history: ChatMessage[], image?: string): AsyncGenerator<string> {
    const apiKey    = process.env.TOGETHER_API_KEY;
    const model     = process.env.TOGETHER_MODEL;
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new InternalServerErrorException("TOGETHER_API_KEY not configured");
    if (!model)  throw new InternalServerErrorException("TOGETHER_MODEL not configured");

    const imageDescription = image ? await this.describeImage(image) : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = await this.buildMessages(history, imageDescription);

    // Only attach the search tool when a Tavily key is present
    const tools = tavilyKey ? [WEB_SEARCH_TOOL] : undefined;

    let iterations = 0;
    const MAX_TOOL_ITERATIONS = 5; // guard against infinite tool-call loops

    while (iterations++ < MAX_TOOL_ITERATIONS) {
      console.log("[Chat] Streaming to TogetherAI — model:", model, "| roles:", messages.map((m: { role: string }) => m.role));

      const response = await fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice:  tools ? "auto" : undefined,
          max_tokens:   512,
          temperature:  0,
          stream:       true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[Chat] TogetherAI stream error", response.status, text);
        throw new InternalServerErrorException(`TogetherAI error ${response.status}: ${text}`);
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      // Accumulate tool call data across chunks (arguments arrive in fragments)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let   pendingToolCall: { id: string; name: string; arguments: string } | null = null;
      let   finishReason   = "";
      // Accumulate the full assistant text for this turn so we can push it
      // back into the message history before the next loop iteration
      let   assistantText  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let delta: any;
          try { delta = JSON.parse(payload); } catch { continue; }

          const choice       = delta?.choices?.[0];
          const content: string = choice?.delta?.content ?? "";
          const toolCalls       = choice?.delta?.tool_calls;
          finishReason          = choice?.finish_reason ?? finishReason;

          // ── Text chunk ──────────────────────────────────────────────────
          if (content) {
            assistantText += content;
            yield content;
          }

          // ── Tool call delta — accumulate fragmented arguments ───────────
          if (toolCalls?.[0]) {
            const tc = toolCalls[0];
            if (tc.id) {
              // First fragment — initialise the pending call
              pendingToolCall = { id: tc.id, name: tc.function?.name ?? "", arguments: "" };
            }
            if (pendingToolCall && tc.function?.arguments) {
              pendingToolCall.arguments += tc.function.arguments;
            }
          }
        }
      }

      // ── No tool call — we're done streaming ──────────────────────────────
      if (!pendingToolCall || finishReason === "stop") return;

      // ── Tool call requested — execute Tavily and loop ────────────────────
      if (pendingToolCall.name === "web_search" && tavilyKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = "";
        try { query = (JSON.parse(pendingToolCall.arguments) as { query: string }).query; } catch {}

        console.log("[Chat] Model requested web_search:", query);

        // Yield a sentinel so the controller can emit a "searching…" event to the client
        yield `\x00SEARCH:${query}\x00`;

        // Execute the Tavily search
        let searchResult = "";
        try {
          const client  = tavily({ apiKey: tavilyKey });
          const results = await client.search(query, { maxResults: 5 });
          searchResult  = results.results
            .map((r: { title: string; url: string; content: string }) =>
              `### ${r.title}\n${r.url}\n${r.content}`)
            .join("\n\n");
        } catch (err) {
          console.warn("[Chat] Tavily search failed:", (err as Error).message);
          searchResult = "Search unavailable.";
        }

        // Push the assistant tool-call message and the tool result into history
        messages.push({
          role:       "assistant",
          content:    assistantText || null,
          tool_calls: [{
            id:       pendingToolCall.id,
            type:     "function",
            function: { name: "web_search", arguments: pendingToolCall.arguments },
          }],
        });
        messages.push({
          role:         "tool",
          tool_call_id: pendingToolCall.id,
          content:      searchResult,
        });
      }
    }
  }
}
