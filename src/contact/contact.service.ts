import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import * as dns from "dns";

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

@Injectable()
export class ContactService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter: any;

  constructor() {
    const port   = Number(process.env.SMTP_PORT ?? 587);
    const secure = port === 465; // SSL on 465, STARTTLS on 587
    const host   = process.env.SMTP_HOST ?? "smtp.gmail.com";

    console.log(`[Contact] Transporter config — host: ${host}, port: ${port}, secure: ${secure}`);

    // Override DNS resolution to force IPv4 — nodemailer's `family` option is
    // not reliably applied by the underlying smtp-connection layer, so we use
    // a custom dnsLookup callback that pins family to 4 before connecting.
    // Ignore the options argument — always resolve to a single IPv4 address.
    const dnsLookup = (hostname: string, _options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      dns.lookup(hostname, 4, (err, address, family) => {
        if (err) {
          console.error(`[Contact] DNS lookup failed for ${hostname}:`, err.message);
        } else {
          console.log(`[Contact] DNS resolved ${hostname} → ${address} (family: ${family})`);
        }
        callback(err, address, family);
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      dnsLookup,
      connectionTimeout: 10_000, // fail fast if the port is firewalled
      greetingTimeout:   5_000,
      socketTimeout:     15_000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    } as any);
  }

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
      const e = err as NodeJS.ErrnoException;
      console.error(`[Contact] Failed to send email — code: ${e.code ?? "unknown"}, message: ${e.message}`);
      throw new InternalServerErrorException("Failed to send email");
    }
  }
}
