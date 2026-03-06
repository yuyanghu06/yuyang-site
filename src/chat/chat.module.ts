import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService     } from "./chat.service";
import { McpModule       } from "../mcp/mcp.module";

/**
 * ChatModule
 * ----------
 * Imports McpModule so ChatService can inject EmbeddingService,
 * PineconeService, and ContextService for the RAG pipeline.
 */
@Module({
  imports:     [McpModule],
  controllers: [ChatController],
  providers:   [ChatService],
})
export class ChatModule {}
