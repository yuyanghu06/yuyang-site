import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { PineconeService  } from "./pinecone.service";
import { ContextService   } from "./context.service";

/**
 * McpModule
 * ---------
 * Groups together all three services that form the RAG (retrieval-augmented
 * generation) pipeline.  Import this module into ChatModule so ChatService
 * can inject them without knowing about their internal dependencies.
 *
 * Exported services:
 *   - EmbeddingService  — text → dense vector via OpenAI
 *   - PineconeService   — vector similarity search + chunk fetching
 *   - ContextService    — neighbor expansion, dedup, and formatting
 */
@Module({
  providers: [EmbeddingService, PineconeService, ContextService],
  exports:   [EmbeddingService, PineconeService, ContextService],
})
export class McpModule {}
