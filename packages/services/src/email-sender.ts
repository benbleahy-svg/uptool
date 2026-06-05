import nodemailer from "nodemailer";
import { getDecryptedSmtpPassword, getValidAccessToken } from "./email-token";
import type { EmailAccount } from "./send-account-resolver";

export interface SendQuoteEmailParams {
  account: EmailAccount;
  to: string;
  subject: string;
  bodyText: string;
  pdfBase64: string;
  pdfFilename: string;
  /** Provider message-id of the inbound message being replied to (threading). */
  replyToMessageId?: string;
  /** Provider thread/conversation id (Gmail threadId). */
  threadId?: string;
}

export interface EmailSendAdapter {
  sendQuoteEmail(params: SendQuoteEmailParams): Promise<void>;
}

const MIME_BOUNDARY = "uptool_mime_boundary_b3f17a";

/** Build an RFC 2822 MIME message (text body + base64 PDF attachment). */
function buildMimeMessage(p: SendQuoteEmailParams): string {
  const headers = [
    `From: ${p.account.email}`,
    `To: ${p.to}`,
    `Subject: ${p.subject}`,
    "MIME-Version: 1.0",
  ];
  if (p.replyToMessageId) {
    headers.push(`In-Reply-To: ${p.replyToMessageId}`);
    headers.push(`References: ${p.replyToMessageId}`);
  }
  headers.push(`Content-Type: multipart/mixed; boundary="${MIME_BOUNDARY}"`);

  // RFC 2045: wrap base64 at 76 chars (base64 contains no newlines, so `.` is safe).
  const wrappedPdf = p.pdfBase64.replace(/.{76}/g, "$&\r\n");

  return [
    headers.join("\r\n"),
    "",
    `--${MIME_BOUNDARY}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    p.bodyText,
    `--${MIME_BOUNDARY}`,
    `Content-Type: application/pdf; name="${p.pdfFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${p.pdfFilename}"`,
    "",
    wrappedPdf,
    `--${MIME_BOUNDARY}--`,
    "",
  ].join("\r\n");
}

export class GmailSendAdapter implements EmailSendAdapter {
  async sendQuoteEmail(p: SendQuoteEmailParams): Promise<void> {
    const token = await getValidAccessToken(p.account.id, "gmail");
    const raw = Buffer.from(buildMimeMessage(p)).toString("base64url");
    const body: { raw: string; threadId?: string } = { raw };
    if (p.threadId) body.threadId = p.threadId;

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
  }
}

export class MicrosoftSendAdapter implements EmailSendAdapter {
  async sendQuoteEmail(p: SendQuoteEmailParams): Promise<void> {
    const token = await getValidAccessToken(p.account.id, "microsoft");
    const attachment = {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: p.pdfFilename,
      contentType: "application/pdf",
      contentBytes: p.pdfBase64,
    };

    let url: string;
    let payload: unknown;
    if (p.replyToMessageId) {
      // Reply on the existing thread; recipients + subject are inherited.
      url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(
        p.replyToMessageId,
      )}/reply`;
      payload = {
        message: { body: { contentType: "Text", content: p.bodyText }, attachments: [attachment] },
      };
    } else {
      url = "https://graph.microsoft.com/v1.0/me/sendMail";
      payload = {
        message: {
          subject: p.subject,
          body: { contentType: "Text", content: p.bodyText },
          toRecipients: [{ emailAddress: { address: p.to } }],
          attachments: [attachment],
        },
        saveToSentItems: true,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Microsoft send failed: ${res.status} ${await res.text()}`);
  }
}

export class ImapSmtpSendAdapter implements EmailSendAdapter {
  async sendQuoteEmail(p: SendQuoteEmailParams): Promise<void> {
    if (!p.account.smtpHost || !p.account.smtpPort) {
      throw new Error(`Email account ${p.account.id} is missing SMTP settings`);
    }
    const password = await getDecryptedSmtpPassword(p.account.id);
    const transporter = nodemailer.createTransport({
      host: p.account.smtpHost,
      port: p.account.smtpPort,
      secure: p.account.smtpTls,
      auth: { user: p.account.email, pass: password },
    });
    await transporter.sendMail({
      from: p.account.email,
      to: p.to,
      subject: p.subject,
      text: p.bodyText,
      // Threading headers (undefined for a fresh thread — nodemailer ignores them).
      inReplyTo: p.replyToMessageId,
      references: p.replyToMessageId,
      attachments: [{ filename: p.pdfFilename, content: Buffer.from(p.pdfBase64, "base64") }],
    });
  }
}

/** Return the send adapter matching the account's provider. */
export function getSendAdapter(account: EmailAccount): EmailSendAdapter {
  switch (account.provider) {
    case "gmail":
      return new GmailSendAdapter();
    case "microsoft":
      return new MicrosoftSendAdapter();
    case "imap":
      return new ImapSmtpSendAdapter();
    default:
      throw new Error(`No send adapter for provider: ${account.provider}`);
  }
}
