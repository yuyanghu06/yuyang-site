import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";

// A single message in the conversation thread
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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

  /**
   * Forward the conversation to the TogetherAI chat completions endpoint
   * and return the assistant's reply as a plain string.
   */
  async chat(history: ChatMessage[]): Promise<string> {
    // Read configuration from environment — fail fast if missing
    const apiKey = process.env.TOGETHER_API_KEY;
    const model  = process.env.TOGETHER_MODEL;

    if (!apiKey) throw new InternalServerErrorException("TOGETHER_API_KEY not configured");
    if (!model)  throw new InternalServerErrorException("TOGETHER_MODEL not configured");

    // Prepend system prompt so it is always the first message
    const messages: ChatMessage[] = [
      { role: "system", content: this.SYSTEM_PROMPT },
      ...history,
    ];

    // TogetherAI exposes an OpenAI-compatible chat completions endpoint
    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(`TogetherAI error: ${text}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    // Extract the assistant content from the standard OpenAI-shaped response
    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    return reply.trim();
  }
}
