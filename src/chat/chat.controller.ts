import { Body, Controller, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatService, ChatMessage } from "./chat.service";

// Shape of the JSON body accepted by the chat endpoint
interface ChatRequestBody {
  messages: ChatMessage[];
  image?:   string;   // base64 data URL for image uploads
}

@Controller("api/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/chat
   * SSE streaming endpoint. Runs the tool-use loop and emits events as they occur:
   *   - tool_call: { type, tool, summary }  — model invoked a tool (retrieve, navigate, etc.)
   *   - response:  { type, content, action } — final clean reply text + parsed action
   *   - done:      { type }                  — stream complete
   *   - error:     { type }                  — something went wrong
   */
  @Post()
  async chat(
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

    try {
      for await (const event of this.chatService.runToolLoop(body.messages, body.image)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      console.error("[Chat] SSE stream error:", (err as Error).message);
      res.write(`data: ${JSON.stringify({ type: "error" })}\n\n`);
    }

    res.end();
  }
}
