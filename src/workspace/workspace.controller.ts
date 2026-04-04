import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { IngestGuard } from "../ingest/ingest.guard";
import { WorkspaceService } from "./workspace.service";
import { ChatMessage } from "../chat/chat.service";

interface WorkspaceRequestBody {
  messages: ChatMessage[];
  image?:   string;
}

/**
 * WorkspaceController
 * -------------------
 * Admin-only chat endpoint for Yuyang's personal workspace.
 * Protected by the same IngestGuard (x-admin-key header) used for /api/ingest.
 * Returns SSE events identical in shape to /api/chat.
 */
@Controller("api/workspace")
@UseGuards(IngestGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * POST /api/workspace
   * SSE streaming endpoint for workspace chat.
   */
  @Post()
  async chat(
    @Body() body: WorkspaceRequestBody,
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
      for await (const event of this.workspaceService.runToolLoop(body.messages, body.image)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      console.error("[Workspace] SSE stream error:", (err as Error).message);
      res.write(`data: ${JSON.stringify({ type: "error" })}\n\n`);
    }

    res.end();
  }
}
