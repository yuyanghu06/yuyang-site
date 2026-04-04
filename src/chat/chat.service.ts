import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { EmbeddingService } from "../mcp/embedding.service";
import { PineconeService  } from "../mcp/pinecone.service";
import { ContextService   } from "../mcp/context.service";
import { TavilyService    } from "../mcp/tavily.service";
import { ContactService   } from "../contact/contact.service";

// ── Bracket-tag regex — matches [toolName] optional params at end of response ─
const TAG_REGEX = /^\[(\w+)\]\s*(.*)$/;

// A single message in the conversation thread
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Parsed bracket tag from model output
export interface ParsedTag {
  tool:   string;           // "retrieve" | "navigate" | "contact" | "redirect" | "message"
  params: string;           // raw parameter string (e.g. "projects", "Yuyang projects portfolio")
}

// Structured reply returned to the controller
export interface ParsedReply {
  text:   string;
  action: { tool: string; parameters: string[] } | null;
}

// SSE event emitted during the tool-use loop
export interface ToolEvent {
  type:    "token" | "tool_call" | "response" | "done";
  tool?:   string;
  summary?: string;
  content?: string;
  action?:  { tool: string; parameters: string[] } | null;
}

/**
 * parseTag
 * --------
 * Scan the raw model output from the bottom up, find the first line that is a
 * bracket-tag tool call, strip it from the text, and return both.
 */
export function parseTag(raw: string): { text: string; tag: ParsedTag | null } {
  const lines = raw.trim().split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    const match = line.match(TAG_REGEX);
    if (match) {
      const tool   = match[1].toLowerCase();
      let params = match[2].trim();
      // Strip any trailing closing bracket that the model may have accidentally included
      params = params.replace(/\]$/, "").trim();
      lines.splice(i, 1);
      const text = lines.join("\n").trim();
      return { text, tag: { tool, params } };
    }
  }

  return { text: raw.trim(), tag: null };
}

/**
 * tagToAction
 * -----------
 * Convert a parsed bracket tag into the action format the frontend expects.
 * Returns null for [retrieve] and [message] (no frontend action needed).
 */
function tagToAction(tag: ParsedTag | null): { tool: string; parameters: string[] } | null {
  if (!tag) return null;
  switch (tag.tool) {
    case "navigate":
    case "redirect":
      return { tool: tag.tool, parameters: tag.params ? [tag.params] : [] };
    case "message":
    default:
      return null;
  }
}

/**
 * toolCallSummary
 * ---------------
 * Generate a human-readable summary for a tool call SSE event.
 */
function toolCallSummary(tag: ParsedTag): string {
  switch (tag.tool) {
    case "retrieve":    return `Searching memory for: ${tag.params}`;
    case "web_search":  return `Searching the web for: ${tag.params}`;
    case "navigate":    return `Navigating to ${tag.params} page`;
    case "send_email":  return `Sending email to Yuyang`;
    case "redirect":    return `Opening ${tag.params}`;
    case "message":     return "";
    default:            return "";
  }
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
    private readonly tavily:    TavilyService,
    private readonly contact:   ContactService,
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
   * callTogetherAIStream
   * --------------------
   * Streaming call to TogetherAI. Returns an async generator that yields
   * individual token chunks as they arrive from the API. The caller is
   * responsible for iterating the generator and collecting the full text.
   */
  private async *callTogetherAIStream(
    messages: ChatMessage[],
  ): AsyncGenerator<string> {
    const apiKey = process.env.TOGETHER_API_KEY;
    const model  = process.env.TOGETHER_MODEL;
    if (!apiKey) throw new InternalServerErrorException("TOGETHER_API_KEY not configured");
    if (!model)  throw new InternalServerErrorException("TOGETHER_MODEL not configured");

    console.log("[Chat] Calling TogetherAI — model:", model, "| roles:", messages.map((m) => m.role));

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.7, stream: true }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Chat] TogetherAI error", response.status, text);
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

        // Process complete lines; keep trailing incomplete line in buffer
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
              if (token) {
                yield token;
              }
            } catch (err) {
              console.warn("[Chat] JSON parse error in stream:", (err as Error).message, "line:", data);
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
   * executeRetrieve
   * ---------------
   * Runs the Pinecone retrieval pipeline for a [retrieve] query and returns
   * formatted context to inject back into the conversation.
   */
  private async executeRetrieve(query: string): Promise<string> {
    const topK        = parseInt(process.env.PINECONE_TOP_K ?? "5", 10);
    const queryVector = await this.embedding.embed(query);
    const matches     = await this.pinecone.queryIndex(queryVector, topK);
    const contextBlock = await this.context.buildContext(matches);

    if (!contextBlock) {
      return "Retrieved context:\n\nNo relevant information found. If the context doesn't contain the answer, say you don't know.";
    }

    // Strip the existing [CONTEXT]...[/CONTEXT] wrapper and use the new format
    const inner = contextBlock.replace(/^\[CONTEXT\]\n?/, "").replace(/\n?\[\/CONTEXT\]$/, "");
    return `Retrieved context:\n\n${inner}\n\nUse this context to inform your response. If the context doesn't contain the answer, say you don't know.`;
  }

  /**
   * executeWebSearch
   * ----------------
   * Runs a Tavily web search and returns formatted results to inject back
   * into the conversation — same pattern as executeRetrieve().
   */
  private async executeWebSearch(query: string): Promise<string> {
    try {
      return await this.tavily.search(query);
    } catch (err) {
      console.warn("[Chat] Web search failed:", (err as Error).message);
      return "Web search results:\n\nSearch failed. Respond based on what you already know, or say you don't know.";
    }
  }

  /**
   * runToolLoop
   * -----------
   * The core agentic tool-use loop. Makes streaming calls to TogetherAI,
   * parses bracket tags, executes [retrieve] or [web_search], and yields
   * SSE events for each token, tool call, and final response. Caps at 3 iterations.
   *
   * Flow:
   *   1. Build system prompt + sanitized history
   *   2. Call TogetherAI (streaming) — emit token events in real-time
   *   3. Parse bracket tag from accumulated response
   *   4. If [retrieve]: emit tool_call event, search Pinecone, inject context, loop
   *   5. If [web_search]: emit tool_call event, search Tavily, inject results, loop
   *   6. If terminal tag: emit tool_call event, emit final response, emit done
   *   7. If no tag: emit final response, emit done
   */
  async *runToolLoop(history: ChatMessage[], image?: string): AsyncGenerator<ToolEvent> {
    const imageDescription = image ? await this.describeImage(image) : undefined;

    // Get current date in ISO format for the model's context
    const now = new Date();
    const currentDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // ── Auto pre-fetch: embed the latest user message and retrieve context ──
    // This seeds the model with relevant context before the first inference call.
    // The model can still issue additional [retrieve] or [web_search] calls to
    // dig deeper — this is just the baseline context injection.
    let autoContext = "";
    const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
    if (lastUserMsg?.content) {
      try {
        const queryText = lastUserMsg.content.trim();
        console.log("[Chat] Auto pre-fetch context for:", queryText.slice(0, 80));
        autoContext = await this.executeRetrieve(queryText);
      } catch (err) {
        console.warn("[Chat] Auto pre-fetch failed:", (err as Error).message);
      }
    }

    // Build the base system prompt with pre-fetched context injected
    const systemPrompt = [
      this.SYSTEM_PROMPT,
      this.TOOLS_PROMPT,
      `Today is ${currentDate}.`,
      ...(autoContext ? [`Initial context from memory:\n\n${autoContext}`] : []),
      ...(imageDescription ? [`[IMAGE]\n${imageDescription}\n[/IMAGE]`] : []),
    ].join("\n\n");

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...sanitizeHistory(history),
    ];

    const MAX_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Call TogetherAI with streaming — yield token events in real-time
      let raw = "";
      for await (const token of this.callTogetherAIStream(messages)) {
        raw += token;
        yield { type: "token", content: token };
      }
      console.log("[Chat] Raw reply:\n", raw);
      const { text, tag } = parseTag(raw.trim());

      // ── [retrieve] — execute search and loop ─────────────────────────────
      if (tag?.tool === "retrieve" && tag.params) {
        const summary = toolCallSummary(tag);
        console.log("[Chat] Tool call: [retrieve]", tag.params);
        yield { type: "tool_call", tool: "retrieve", summary };

        let contextContent: string;
        try {
          contextContent = await this.executeRetrieve(tag.params);
        } catch (err) {
          console.warn("[Chat] Retrieve failed:", (err as Error).message);
          contextContent = "Retrieved context:\n\nRetrieval failed. Respond based on what you already know, or say you don't know.";
        }

        // Push the assistant's partial response and the retrieved context
        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system", content: contextContent });
        continue; // loop back for another inference call
      }

      // ── [web_search] — search the web via Tavily and loop ────────────────
      if (tag?.tool === "web_search" && tag.params) {
        const summary = toolCallSummary(tag);
        console.log("[Chat] Tool call: [web_search]", tag.params);
        yield { type: "tool_call", tool: "web_search", summary };

        const searchResults = await this.executeWebSearch(tag.params);

        // Push the assistant's partial response and the web search results
        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system", content: searchResults });
        continue; // loop back for another inference call
      }

      // ── [send_email] — send email via ContactService and loop ────────────
      if (tag?.tool === "send_email" && tag.params) {
        const separatorIdx = tag.params.indexOf(" | ");
        const summary = toolCallSummary(tag);
        yield { type: "tool_call", tool: "send_email", summary };

        if (separatorIdx === -1) {
          // Malformed tag — ask model to retry with correct format
          console.warn("[Chat] [send_email] malformed params:", tag.params);
          messages.push({ role: "assistant", content: raw.trim() });
          messages.push({ role: "system",    content: "Error: the [send_email] tag was malformed. Required format: [send_email] email@example.com | message text. Please try again." });
          continue;
        }

        const visitorEmail   = tag.params.slice(0, separatorIdx).trim();
        const visitorMessage = tag.params.slice(separatorIdx + 3).trim();

        console.log(`[Chat] [send_email] attempting — from: ${visitorEmail}`);

        let resultContext: string;
        try {
          await this.contact.send({ name: "", email: visitorEmail, message: visitorMessage });
          console.log(`[Chat] [send_email] success — from: ${visitorEmail}`);
          resultContext = `Email sent successfully. Yuyang will receive the message and can reply to ${visitorEmail}. Tell the visitor their message has been delivered.`;
        } catch (err) {
          console.error(`[Chat] [send_email] failed — from: ${visitorEmail}:`, (err as Error).message);
          resultContext = "Email send failed due to a server error. Apologize to the visitor and suggest they try the contact page at /contact directly.";
        }

        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system",    content: resultContext });
        continue; // loop back for final response
      }

      // ── Terminal tag (navigate, redirect, message) or no tag ─────────────
      if (tag && tag.tool !== "message") {
        const summary = toolCallSummary(tag);
        if (summary) {
          yield { type: "tool_call", tool: tag.tool, summary };
        }
      }

      const action = tagToAction(tag);
      const fallbacks: Record<string, string> = {
        navigate: "On it.",
        redirect: "Here you go.",
      };
      const finalText = text || (tag ? fallbacks[tag.tool] ?? "" : "") || ".";

      yield { type: "response", content: finalText, action };
      yield { type: "done" };
      return;
    }

    // Max iterations reached — force return whatever we have
    console.warn("[Chat] Max tool-use iterations reached, force-returning");
    yield { type: "response", content: "I wasn't able to find that information. Could you try rephrasing?", action: null };
    yield { type: "done" };
  }
}
