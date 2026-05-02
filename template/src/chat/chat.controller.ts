import { Body, Controller, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { ChatService, ChatMessage } from "./chat.service";

interface ChatRequestBody {
  messages: ChatMessage[];
  image?:   string;
}

@Controller("api/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
