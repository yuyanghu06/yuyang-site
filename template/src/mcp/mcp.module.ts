import { Module } from "@nestjs/common";
import { EmbeddingService } from "./embedding.service";
import { PineconeService  } from "./pinecone.service";
import { ContextService   } from "./context.service";
import { TavilyService    } from "./tavily.service";

@Module({
  providers: [EmbeddingService, PineconeService, ContextService, TavilyService],
  exports:   [EmbeddingService, PineconeService, ContextService, TavilyService],
})
export class McpModule {}
