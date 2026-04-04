import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { EmbeddingService } from "../mcp/embedding.service";
import { PineconeService  } from "../mcp/pinecone.service";
import { ContextService   } from "../mcp/context.service";
import { TavilyService    } from "../mcp/tavily.service";
import { parseTag, ChatMessage, ToolEvent } from "../chat/chat.service";

// ── Max iterations — higher than the public chat to allow deep research ──────
const MAX_ITERATIONS = 25;

// ── Max output tokens — longer than public chat for cover letters, essays ────
const MAX_TOKENS = 4096;

/**
 * sanitizeHistory
 * ---------------
 * Ensures the message array sent to TogetherAI is valid:
 *   1. Strips any leading assistant messages (greeting, etc.)
 *   2. Merges consecutive same-role messages so the conversation alternates.
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

/**
 * WorkspaceService
 * ----------------
 * Private reasoning assistant for Yuyang's personal workspace.
 * Same RAG pipeline as the public chat (Pinecone retrieval, Tavily web search,
 * GPT-4o image descriptions) but with:
 *   - A workspace-specific system prompt focused on professional tasks
 *   - Higher iteration cap (25 vs 10) for deeper research chains
 *   - Higher max_tokens (4096 vs 512) for long-form output
 *   - No frontend action tags (navigate/contact/redirect)
 */
@Injectable()
export class WorkspaceService {
  private readonly WORKSPACE_PROMPT: string = readFileSync(
    join(__dirname, "..", "..", "..", "prompts", "WORKSPACE_PROMPT.md"),
    "utf-8",
  ).trim();

  private readonly WORKSPACE_TOOLS: string = readFileSync(
    join(__dirname, "..", "..", "..", "prompts", "WORKSPACE_TOOLS.md"),
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
    private readonly tavily:    TavilyService,
  ) {}

  /**
   * describeImage
   * -------------
   * Sends a base64 data URL to GPT-4o and returns a plain-text description
   * to be injected into the workspace context.
   */
  private async describeImage(dataUrl: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new InternalServerErrorException("OPENAI_API_KEY not configured");

    console.log("[Workspace] Sending image to GPT-4o for description…");
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
      console.error("[Workspace] GPT-4o vision error", response.status, err);
      throw new InternalServerErrorException(`OpenAI Vision error ${response.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const description: string = data?.choices?.[0]?.message?.content ?? "";
    console.log("[Workspace] Image description:\n", description);
    return description;
  }

  /**
   * callTogetherAIStream
   * --------------------
   * Streaming call to TogetherAI with workspace-tuned parameters.
   */
  private async *callTogetherAIStream(
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    const apiKey = process.env.TOGETHER_API_KEY;
    const model  = process.env.TOGETHER_MODEL;
    if (!apiKey) throw new InternalServerErrorException("TOGETHER_API_KEY not configured");
    if (!model)  throw new InternalServerErrorException("TOGETHER_MODEL not configured");

    console.log("[Workspace] Calling TogetherAI — model:", model, "| msgs:", messages.length);

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens:  MAX_TOKENS,
        temperature: 0.7,
        stream:      true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Workspace] TogetherAI error", response.status, text);
      throw new InternalServerErrorException(`TogetherAI error ${response.status}: ${text}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            if (!data) continue;

            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parsed: any = JSON.parse(data);
              const token = parsed?.choices?.[0]?.delta?.content ?? "";
              if (token) yield token;
            } catch (err) {
              console.warn("[Workspace] JSON parse error:", (err as Error).message);
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * executeRetrieve — embed query, search Pinecone, build context block.
   */
  private async executeRetrieve(query: string): Promise<string> {
    const topK        = parseInt(process.env.PINECONE_TOP_K ?? "5", 10);
    const queryVector = await this.embedding.embed(query);
    const matches     = await this.pinecone.queryIndex(queryVector, topK);
    const contextBlock = await this.context.buildContext(matches);

    if (!contextBlock) {
      return "Retrieved context:\n\nNo relevant information found.";
    }

    const inner = contextBlock.replace(/^\[CONTEXT\]\n?/, "").replace(/\n?\[\/CONTEXT\]$/, "");
    return `Retrieved context:\n\n${inner}\n\nUse this context to inform your response. If the context doesn't contain the answer, say so.`;
  }

  /**
   * executeWebSearch — Tavily web search.
   */
  private async executeWebSearch(query: string): Promise<string> {
    try {
      return await this.tavily.search(query);
    } catch (err) {
      console.warn("[Workspace] Web search failed:", (err as Error).message);
      return "Web search results:\n\nSearch failed. Respond based on what you already know.";
    }
  }

  /**
   * runToolLoop
   * -----------
   * Core agentic loop for the workspace. Same structure as the public chat
   * but with higher iteration cap, longer outputs, and no frontend actions.
   *
   * Tools: [retrieve], [web_search] → loop. Anything else → terminal.
   */
  async *runToolLoop(history: ChatMessage[], image?: string): AsyncGenerator<ToolEvent> {
    const imageDescription = image ? await this.describeImage(image) : undefined;

    const now = new Date();
    const currentDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Auto pre-fetch: embed the latest user message for baseline context
    let autoContext = "";
    const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
    if (lastUserMsg?.content) {
      try {
        const queryText = lastUserMsg.content.trim();
        console.log("[Workspace] Auto pre-fetch for:", queryText.slice(0, 80));
        autoContext = await this.executeRetrieve(queryText);
      } catch (err) {
        console.warn("[Workspace] Auto pre-fetch failed:", (err as Error).message);
      }
    }

    const systemPrompt = [
      this.WORKSPACE_PROMPT,
      this.WORKSPACE_TOOLS,
      `Today is ${currentDate}.`,
      ...(autoContext ? [`Initial context from memory:\n\n${autoContext}`] : []),
      ...(imageDescription ? [`[IMAGE]\n${imageDescription}\n[/IMAGE]`] : []),
    ].join("\n\n");

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizeHistory(history),
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      let raw = "";
      for await (const token of this.callTogetherAIStream(messages)) {
        raw += token;
        yield { type: "token", content: token };
      }
      console.log("[Workspace] Raw reply (iteration", iteration, "):\n", raw.slice(0, 200));

      const { text, tag } = parseTag(raw.trim());

      // ── [retrieve] — search Pinecone and loop ─────────────────────────────
      if (tag?.tool === "retrieve" && tag.params) {
        console.log("[Workspace] Tool: [retrieve]", tag.params);
        yield { type: "tool_call", tool: "retrieve", summary: `Searching memory for: ${tag.params}` };

        let contextContent: string;
        try {
          contextContent = await this.executeRetrieve(tag.params);
        } catch (err) {
          console.warn("[Workspace] Retrieve failed:", (err as Error).message);
          contextContent = "Retrieved context:\n\nRetrieval failed. Work with what you have.";
        }

        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system", content: contextContent });
        continue;
      }

      // ── [web_search] — search the web and loop ────────────────────────────
      if (tag?.tool === "web_search" && tag.params) {
        console.log("[Workspace] Tool: [web_search]", tag.params);
        yield { type: "tool_call", tool: "web_search", summary: `Searching the web for: ${tag.params}` };

        const searchResults = await this.executeWebSearch(tag.params);

        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system", content: searchResults });
        continue;
      }

      // ── Terminal — no looping tool found, return final response ────────────
      const finalText = text || ".";
      yield { type: "response", content: finalText, action: null };
      yield { type: "done" };
      return;
    }

    // Max iterations reached
    console.warn("[Workspace] Max iterations reached (" + MAX_ITERATIONS + ")");
    yield {
      type: "response",
      content: "I've hit my research limit for this turn. Here's what I have so far — let me know if you want me to continue from here.",
      action: null,
    };
    yield { type: "done" };
  }
}
