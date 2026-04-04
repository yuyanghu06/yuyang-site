import { Module } from "@nestjs/common";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceService }    from "./workspace.service";
import { McpModule }           from "../mcp/mcp.module";
import { IngestGuard }         from "../ingest/ingest.guard";

/**
 * WorkspaceModule
 * ---------------
 * Admin-only private workspace chat module.
 * Imports McpModule for the same RAG pipeline (Pinecone, OpenAI, Tavily)
 * used by the public chat, but with workspace-specific prompts and config.
 * IngestGuard is registered here explicitly so NestJS DI resolves it correctly.
 */
@Module({
  imports:     [McpModule],
  controllers: [WorkspaceController],
  providers:   [WorkspaceService, IngestGuard],
})
export class WorkspaceModule {}
