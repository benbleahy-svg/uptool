import { db, } from "@uptool/db";
import { isManufacturingFile } from "@uptool/shared";
import { blockListService } from "./block-list";
import { rfqService } from "./rfq";

export interface IngestPayload {
  orgId: string;
  emailAccountId: string;
  provider: "microsoft" | "gmail";
  providerMessageId: string;
  providerThreadId: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  subject?: string;
  bodyText?: string;
  receivedAt: Date;
  attachments: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    data: Buffer;
  }>;
}

export const emailIngestService = {
  async ingestMessage(payload: IngestPayload): Promise<"created" | "appended" | "skipped"> {
    // Idempotency: skip if already processed
    const existing = await db.query.emailMessages.findFirst({
      where: (m, { eq }) => eq(m.providerMessageId, payload.providerMessageId),
    });
    if (existing) return "skipped";

    // Block list check
    const blocked = await blockListService.isBlocked(payload.orgId, payload.fromEmail);
    if (blocked) return "skipped";

    // Check if thread already exists (reply to existing RFQ)
    const existingThread = await db.query.emailThreads.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.orgId, payload.orgId),
          eq(t.providerThreadId, payload.providerThreadId),
          eq(t.provider, payload.provider),
        ),
    });

    if (existingThread) {
      await rfqService.addMessageToThread({
        orgId: payload.orgId,
        threadId: existingThread.id,
        rfqId: existingThread.rfqId,
        providerMessageId: payload.providerMessageId,
        fromEmail: payload.fromEmail,
        fromName: payload.fromName,
        toEmails: payload.toEmails,
        subject: payload.subject,
        bodyText: payload.bodyText,
        receivedAt: payload.receivedAt,
      });
      return "appended";
    }

    // New thread: only create RFQ if there are qualifying attachments
    const hasManufacturingAttachments = payload.attachments.some((a) =>
      isManufacturingFile(a.filename),
    );
    if (!hasManufacturingAttachments) return "skipped";

    await rfqService.createFromEmail({
      orgId: payload.orgId,
      emailAccountId: payload.emailAccountId,
      provider: payload.provider,
      providerThreadId: payload.providerThreadId,
      providerMessageId: payload.providerMessageId,
      fromEmail: payload.fromEmail,
      fromName: payload.fromName,
      toEmails: payload.toEmails,
      subject: payload.subject,
      bodyText: payload.bodyText,
      receivedAt: payload.receivedAt,
      attachmentFiles: payload.attachments,
    });

    return "created";
  },
};
