import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService     } from "./chat.service";
import { McpModule       } from "../mcp/mcp.module";

@Module({
  imports:     [McpModule],
  controllers: [ChatController],
  providers:   [ChatService],
})
export class ChatModule {}
