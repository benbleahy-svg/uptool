import { emailIngestService } from "@uptool/services";
import type { Job } from "bullmq";
import type { IngestEmailJobData } from "../queues";
import { logger } from "../logger";

export async function ingestEmailProcessor(job: Job<IngestEmailJobData>): Promise<void> {
  const { orgId, providerMessageId } = job.data;
  const log = logger.child({ orgId, providerMessageId, job: "ingest-email" });

  const attachments = job.data.attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    data: Buffer.from(a.dataBase64, "base64"),
  }));

  const result = await emailIngestService.ingestMessage({
    orgId: job.data.orgId,
    emailAccountId: job.data.emailAccountId,
    provider: job.data.provider,
    providerMessageId: job.data.providerMessageId,
    providerThreadId: job.data.providerThreadId,
    fromEmail: job.data.fromEmail,
    fromName: job.data.fromName,
    toEmails: job.data.toEmails,
    subject: job.data.subject,
    bodyText: job.data.bodyText,
    receivedAt: new Date(job.data.receivedAt),
    attachments,
  });

  log.info({ result }, "Ingest complete");
}
