import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from "nodemailer";

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

@Injectable()
export class ContactService {
  private transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    family: 4, // force IPv4 — production hosts often lack outbound IPv6 routing
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async send({ name, email, message }: ContactPayload): Promise<void> {
    const to = process.env.CONTACT_EMAIL;
    if (!to) throw new InternalServerErrorException("CONTACT_EMAIL not configured");

    console.log(`[Contact] Sending email — from: ${email}, to: ${to}, subject: "New message from ${name || email}"`);

    try {
      await this.transporter.sendMail({
        from: `"${name || "Site Visitor"}" <${process.env.SMTP_USER}>`,
        replyTo: email,
        to,
        subject: `New message from ${name || email}`,
        text: message,
        html: `<p><strong>From:</strong> ${name || "Site Visitor"} &lt;${email}&gt;</p><p>${message.replace(/\n/g, "<br>")}</p>`,
      });
      console.log(`[Contact] Email sent successfully — from: ${email}`);
    } catch (err) {
      console.error(`[Contact] Failed to send email — from: ${email}:`, (err as Error).message);
      throw new InternalServerErrorException("Failed to send email");
    }
  }
}
