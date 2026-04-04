import { Module } from "@nestjs/common";
import { WorkspaceController } from "./workspace.controller";
import { WorkspaceService }    from "./workspace.service";
import { McpModule }           from "../mcp/mcp.module";

/**
 * WorkspaceModule
 * ---------------
 * Admin-only private workspace chat module.
 * Imports McpModule for the same RAG pipeline (Pinecone, OpenAI, Tavily)
 * used by the public chat, but with workspace-specific prompts and config.
 */
@Module({
  imports:     [McpModule],
  controllers: [WorkspaceController],
  providers:   [WorkspaceService],
})
export class WorkspaceModule {}
