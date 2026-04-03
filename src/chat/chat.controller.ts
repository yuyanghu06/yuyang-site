import { Body, Controller, Post, HttpCode, BadRequestException, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatService, ChatMessage, parseReply } from "./chat.service";

// Shape of the JSON body accepted by both chat endpoints
interface ChatRequestBody {
  messages: ChatMessage[];
  image?:   string;   // base64 data URL for image uploads
}

// Shape of the JSON response for the non-streaming endpoint
interface ChatResponseBody {
  reply:  string;
  action: { tool: string; parameters: string[] } | null;
}

@Controller("api/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/chat
   * Non-streaming fallback. Returns the full reply + action once complete.
   */
  @Post()
  @HttpCode(200)
  async chat(@Body() body: ChatRequestBody): Promise<ChatResponseBody> {
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      throw new BadRequestException("messages array is required");
    }
    const { text, action } = await this.chatService.chat(body.messages, body.image);
    return { reply: text, action };
  }

  /**
   * POST /api/chat/stream
   * Streaming endpoint. Sends SSE events as chunks arrive, then a final
   * "done" event containing the clean reply text and parsed action.
   *
   * Event shapes:
   *   { type: "chunk", text: string }          — partial text fragment
   *   { type: "done",  reply: string, action }  — final clean text + action
   *   { type: "error" }                          — stream failure
   */
  @Post("stream")
  async chatStream(
    @Body() body: ChatRequestBody,
    @Res() res: Response,
  ): Promise<void> {
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      res.status(400).json({ message: "messages array is required" });
      return;
    }

    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.flushHeaders();

    let fullText = "";

    try {
      for await (const chunk of this.chatService.streamChunks(body.messages, body.image)) {
        // Sentinel format emitted by the service when the model calls web_search:
        //   "\x00SEARCH:<query>\x00"
        // Strip it from the display text and forward as a "searching" event instead.
        const searchMatch = chunk.match(/^\x00SEARCH:([\s\S]*?)\x00$/);
        if (searchMatch) {
          res.write(`data: ${JSON.stringify({ type: "searching", query: searchMatch[1] })}\n\n`);
          continue;
        }

        fullText += chunk;
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error" })}\n\n`);
      res.end();
      return;
    }

    // Full text accumulated — strip tool call and send structured done event
    const { text, action } = parseReply(fullText.trim());
    res.write(`data: ${JSON.stringify({ type: "done", reply: text, action })}\n\n`);
    res.end();
  }
}
