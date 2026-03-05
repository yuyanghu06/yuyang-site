import { Body, Controller, Post, HttpCode, BadRequestException } from "@nestjs/common";
import { ChatService, ChatMessage } from "./chat.service";

// Shape of the JSON body accepted by POST /api/chat
interface ChatRequestBody {
  messages: ChatMessage[];
}

@Controller("api/chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * POST /api/chat
   * Body: { messages: [{ role, content }, ...] }
   * Returns: { reply: string }
   */
  @Post()
  @HttpCode(200)
  async chat(@Body() body: ChatRequestBody): Promise<{ reply: string }> {
    // Validate that messages array is present and non-empty
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      throw new BadRequestException("messages array is required");
    }

    const reply = await this.chatService.chat(body.messages);
    return { reply };
  }
}
