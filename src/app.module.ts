import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { ContactModule } from "./contact/contact.module";
import { ChatModule } from "./chat/chat.module";

@Module({
  imports: [ConfigModule.forRoot(), ContactModule, ChatModule],
  controllers: [AppController],
})
export class AppModule {}
