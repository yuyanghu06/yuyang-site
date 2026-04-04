import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService     } from "./chat.service";
import { McpModule       } from "../mcp/mcp.module";
import { ContactModule   } from "../contact/contact.module";

/**
 * ChatModule
 * ----------
 * Imports McpModule for the RAG pipeline (embedding, Pinecone, Tavily).
 * Imports ContactModule so ChatService can send emails directly from the
 * [send_email] tool call inside the tool-use loop.
 */
@Module({
  imports:     [McpModule, ContactModule],
  controllers: [ChatController],
  providers:   [ChatService],
})
export class ChatModule {}
