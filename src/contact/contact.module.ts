import { Module } from "@nestjs/common";
import { ContactController } from "./contact.controller";
import { ContactService } from "./contact.service";

@Module({
  controllers: [ContactController],
  providers:   [ContactService],
  exports:     [ContactService], // shared with ChatModule for in-loop email sending
})
export class ContactModule {}
