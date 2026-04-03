import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { PineconeService  } from "./pinecone.service";
import { ContextService   } from "./context.service";
import { TavilyService    } from "./tavily.service";

/**
 * McpModule
 * ---------
 * Groups together all services that form the RAG (retrieval-augmented
 * generation) and web search pipeline.  Import this module into ChatModule
 * so ChatService can inject them without knowing about their internal
 * dependencies.
 *
 * Exported services:
 *   - EmbeddingService  — text → dense vector via OpenAI
 *   - PineconeService   — vector similarity search + chunk fetching
 *   - ContextService    — neighbor expansion, dedup, and formatting
 *   - TavilyService     — web search via Tavily API
 */
@Module({
  providers: [EmbeddingService, PineconeService, ContextService, TavilyService],
  exports:   [EmbeddingService, PineconeService, ContextService, TavilyService],
})
export class McpModule {}
