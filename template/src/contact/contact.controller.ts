import { Body, Controller, Post, HttpCode } from "@nestjs/common";
import { ContactService, ContactPayload } from "./contact.service";

@Controller("api/contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(200)
  async send(@Body() body: ContactPayload): Promise<{ ok: boolean }> {
    await this.contact.send(body);
    return { ok: true };
  }
}
