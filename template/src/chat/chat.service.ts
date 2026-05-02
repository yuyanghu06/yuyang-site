import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { EmbeddingService } from "../mcp/embedding.service";
import { PineconeService  } from "../mcp/pinecone.service";
import { ContextService   } from "../mcp/context.service";
import { TavilyService    } from "../mcp/tavily.service";

const TAG_REGEX = /^\[(\w+)\]\s*(.*)$/;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ParsedTag {
  tool:   string;
  params: string;
}

export interface ParsedReply {
  text:   string;
  action: { tool: string; parameters: string[] } | null;
}

export interface ToolEvent {
  type:    "token" | "tool_call" | "response" | "done";
  tool?:   string;
  summary?: string;
  content?: string;
  action?:  { tool: string; parameters: string[] } | null;
}

export function parseTag(raw: string): { text: string; tag: ParsedTag | null } {
  const lines = raw.trim().split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    const match = line.match(TAG_REGEX);
    if (match) {
      const tool   = match[1].toLowerCase();
      let params = match[2].trim();
      params = params.replace(/\]$/, "").trim();
      lines.splice(i, 1);
      const text = lines.join("\n").trim();
      return { text, tag: { tool, params } };
    }
  }

  return { text: raw.trim(), tag: null };
}

function tagToAction(tag: ParsedTag | null): { tool: string; parameters: string[] } | null {
  if (!tag) return null;
  switch (tag.tool) {
    case "navigate":
    case "redirect":
      return { tool: tag.tool, parameters: tag.params ? [tag.params] : [] };
    case "contact":
      return { tool: "contact", parameters: [] };
    case "message":
    default:
      return null;
  }
}

function toolCallSummary(tag: ParsedTag): string {
  switch (tag.tool) {
    case "retrieve":    return `Searching memory for: ${tag.params}`;
    case "web_search":  return `Searching the web for: ${tag.params}`;
    case "navigate":    return `Navigating to ${tag.params} page`;
    case "contact":     return "Opening contact flow";
    case "redirect":    return `Opening ${tag.params}`;
    case "message":     return "";
    default:            return "";
  }
}

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
  ) {}

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

  private async executeRetrieve(query: string): Promise<string> {
    const topK        = parseInt(process.env.PINECONE_TOP_K ?? "5", 10);
    const queryVector = await this.embedding.embed(query);
    const matches     = await this.pinecone.queryIndex(queryVector, topK);
    const contextBlock = await this.context.buildContext(matches);

    if (!contextBlock) {
      return "Retrieved context:\n\nNo relevant information found. If the context doesn't contain the answer, say you don't know.";
    }

    const inner = contextBlock.replace(/^\[CONTEXT\]\n?/, "").replace(/\n?\[\/CONTEXT\]$/, "");
    return `Retrieved context:\n\n${inner}\n\nUse this context to inform your response. If the context doesn't contain the answer, say you don't know.`;
  }

  private async executeWebSearch(query: string): Promise<string> {
    try {
      return await this.tavily.search(query);
    } catch (err) {
      console.warn("[Chat] Web search failed:", (err as Error).message);
      return "Web search results:\n\nSearch failed. Respond based on what you already know, or say you don't know.";
    }
  }

  async *runToolLoop(history: ChatMessage[], image?: string): AsyncGenerator<ToolEvent> {
    const imageDescription = image ? await this.describeImage(image) : undefined;

    const now = new Date();
    const currentDate = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

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
      let raw = "";
      for await (const token of this.callTogetherAIStream(messages)) {
        raw += token;
        yield { type: "token", content: token };
      }
      console.log("[Chat] Raw reply:\n", raw);
      const { text, tag } = parseTag(raw.trim());

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

        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system", content: contextContent });
        continue;
      }

      if (tag?.tool === "web_search" && tag.params) {
        const summary = toolCallSummary(tag);
        console.log("[Chat] Tool call: [web_search]", tag.params);
        yield { type: "tool_call", tool: "web_search", summary };

        const searchResults = await this.executeWebSearch(tag.params);

        messages.push({ role: "assistant", content: raw.trim() });
        messages.push({ role: "system", content: searchResults });
        continue;
      }

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
        contact:  "Let's get you in touch.",
      };
      const finalText = text || (tag ? fallbacks[tag.tool] ?? "" : "") || ".";

      yield { type: "response", content: finalText, action };
      yield { type: "done" };
      return;
    }

    console.warn("[Chat] Max tool-use iterations reached, force-returning");
    yield { type: "response", content: "I wasn't able to find that information. Could you try rephrasing?", action: null };
    yield { type: "done" };
  }
}
