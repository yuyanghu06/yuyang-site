import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { ContactModule } from "./contact/contact.module";
import { ChatModule } from "./chat/chat.module";
import { IngestModule } from "./ingest/ingest.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [ConfigModule.forRoot(), ContactModule, ChatModule, IngestModule, WorkspaceModule],
  controllers: [AppController],
})
export class AppModule {}
