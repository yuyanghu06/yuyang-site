import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Resend } from "resend";

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

@Injectable()
export class ContactService {
  private readonly resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[Contact] RESEND_API_KEY is not set");
    }
    this.resend = new Resend(apiKey);
  }

  async send({ name, email, message }: ContactPayload): Promise<void> {
    const to = process.env.CONTACT_EMAIL;
    if (!to) throw new InternalServerErrorException("CONTACT_EMAIL not configured");

    const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const subject = `New message from ${name || email}`;

    console.log(`[Contact] Sending email via Resend — from: ${email}, to: ${to}`);

    const { error } = await this.resend.emails.send({
      from,
      replyTo: email,
      to,
      subject,
      text: message,
      html: `<p><strong>From:</strong> ${name || "Site Visitor"} &lt;${email}&gt;</p><p>${message.replace(/\n/g, "<br>")}</p>`,
    });

    if (error) {
      console.error("[Contact] Resend error:", error.name, error.message);
      throw new InternalServerErrorException("Failed to send email");
    }

    console.log(`[Contact] Email sent successfully — from: ${email}`);
  }
}
