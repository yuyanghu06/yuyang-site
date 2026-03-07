import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { EmbeddingService } from "../mcp/embedding.service";
import { PineconeService  } from "../mcp/pinecone.service";
import { ContextService   } from "../mcp/context.service";

// A single message in the conversation thread
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * sanitizeHistory
 * ---------------
 * Ensures the message array sent to TogetherAI is valid:
 *   1. Strips any leading assistant messages (the UI greeting, contact-flow prompts, etc.)
 *      because the first non-system message must be from the user.
 *   2. Merges consecutive same-role messages so the conversation strictly alternates.
 *      Consecutive assistant messages can occur when the contact-flow state machine
 *      appends a local prompt right after the AI's reply.
 */
function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
  // 1. Drop leading assistant messages
  let start = 0;
  while (start < history.length && history[start].role !== "user") start++;
  const trimmed = history.slice(start);
  if (trimmed.length === 0) return [];

  // 2. Merge consecutive messages with the same role, and drop empty-content messages
  //    (empty content can occur if the model replies with only an action tag and nothing
  //    else — parseActions strips the tag leaving an empty string that TogetherAI rejects)
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
  // Load the system prompt once at startup from prompts/SYSTEM_PROMPT.md.
  // __dirname in compiled output is dist/server/chat/, so we walk up two levels
  // to reach the project root where prompts/ lives.
  private readonly SYSTEM_PROMPT: string = readFileSync(
    join(__dirname, "..", "..", "..", "prompts", "SYSTEM_PROMPT.md"),
    "utf-8",
  ).trim();

  constructor(
    // MCP pipeline services injected by McpModule
    private readonly embedding: EmbeddingService,
    private readonly pinecone:  PineconeService,
    private readonly context:   ContextService,
  ) {}

  /**
   * Run the full RAG pipeline then call TogetherAI for a final reply.
   *
   * Pipeline:
   *   1. Extract the last user message from history
   *   2. Embed it via EmbeddingService (OpenAI /v1/embeddings)
   *   3. Similarity-search Pinecone for the top-K most relevant chunks
   *   4. Expand each match with its immediate neighbors via ContextService
   *   5. Inject the resulting context block into the system prompt
   *   6. Forward the enriched messages array to TogetherAI /v1/chat/completions
   *
   * If any step in the RAG pipeline fails (e.g. missing Pinecone key in dev),
   * the service falls back gracefully to a context-free call — the chat still
   * works, just without retrieval.
   */
  async chat(history: ChatMessage[]): Promise<string> {
    // Read configuration from environment — fail fast if missing
    const apiKey = process.env.TOGETHER_API_KEY;
    const model  = process.env.TOGETHER_MODEL;

    if (!apiKey) throw new InternalServerErrorException("TOGETHER_API_KEY not configured");
    if (!model)  throw new InternalServerErrorException("TOGETHER_MODEL not configured");

    // ── RAG step — build the context block from retrieved knowledge ──────────
    let contextBlock = "";
    try {
      // Step 1: find the most recent user message to use as the retrieval query
      const lastUserMsg = [...history].reverse().find((m) => m.role === "user");

      if (lastUserMsg) {
        const topK = parseInt(process.env.PINECONE_TOP_K ?? "5", 10);

        // Step 2: embed the user's query
        const queryVector = await this.embedding.embed(lastUserMsg.content);

        // Step 3: retrieve the nearest knowledge chunks
        const matches     = await this.pinecone.queryIndex(queryVector, topK);

        // Step 4: expand neighbors and format into a context string
        contextBlock      = await this.context.buildContext(matches);
      }
    } catch (err) {
      // Log the RAG failure but continue — the LLM will answer from its own knowledge
      console.warn("[MCP] RAG pipeline failed, falling back to context-free chat:", (err as Error).message);
    }

    // ── Build the enriched system prompt ────────────────────────────────────
    // If context was retrieved, append it directly after the system instructions
    // so the model treats it as reference material, not as a user turn.
    const enrichedSystemPrompt = contextBlock
      ? `${this.SYSTEM_PROMPT}\n\n${contextBlock}`
      : this.SYSTEM_PROMPT;

    // ── Sanitize history before assembling the final messages array ─────────
    // TogetherAI (like most OpenAI-compatible APIs) requires:
    //   1. First non-system message must be from the user
    //   2. Messages must strictly alternate user / assistant
    //
    // The frontend history may violate both rules because:
    //   - The UI shows an assistant greeting as the first message
    //   - The contact-flow state machine injects consecutive assistant messages
    //     (AI reply + local "What's your email?" prompt) without user turns in between
    const sanitizedHistory = sanitizeHistory(history);

    // ── Assemble the final messages array ────────────────────────────────────
    const messages: ChatMessage[] = [
      { role: "system", content: enrichedSystemPrompt },
      ...sanitizedHistory,
    ];

    // ── Call TogetherAI (OpenAI-compatible endpoint) ─────────────────────────
    const requestBody = {
      model,
      messages,
      max_tokens:  512,
      temperature: 0.7,
    };

    // Log the sanitized message roles so we can confirm the history is valid
    console.log("[Chat] Sending to TogetherAI — model:", model, "| message roles:", messages.map((m) => m.role));

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Chat] TogetherAI returned", response.status, text);
      throw new InternalServerErrorException(`TogetherAI error ${response.status}: ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    // Extract the assistant content from the standard OpenAI-shaped response
    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    return reply.trim();
  }
}
