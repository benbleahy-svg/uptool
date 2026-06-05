import { db } from "@uptool/db";
import { emailAccountService } from "@uptool/services";
import { getValidAccessToken } from "@uptool/services";
import type { Job } from "bullmq";
import { ingestEmailQueue, type IngestEmailJobData, type PollEmailAccountJobData } from "../queues";
import { logger } from "../logger";

async function fetchMicrosoftMessages(
  accessToken: string,
  since: Date | null,
): Promise<MsMessage[]> {
  const filter = since
    ? `receivedDateTime ge ${since.toISOString()}`
    : `receivedDateTime ge ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`;

  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filter)}&$select=id,conversationId,subject,from,toRecipients,body,receivedDateTime,hasAttachments&$top=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MS Graph messages failed: ${res.status}`);
  const data = (await res.json()) as { value: MsMessage[] };
  return data.value;
}

async function fetchMicrosoftAttachments(
  accessToken: string,
  messageId: string,
): Promise<MsAttachment[]> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { value: MsAttachment[] };
  return data.value.filter((a) => !a.isInline);
}

async function fetchGmailMessages(accessToken: string, since: Date | null): Promise<string[]> {
  const afterEpoch = since
    ? Math.floor(since.getTime() / 1000)
    : Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${afterEpoch} in:inbox&maxResults=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail messages list failed: ${res.status}`);
  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return (data.messages ?? []).map((m) => m.id);
}

async function fetchGmailMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${res.status}`);
  return (await res.json()) as GmailMessage;
}

function getGmailHeader(msg: GmailMessage, name: string): string {
  return msg.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractGmailText(msg: GmailMessage): string {
  const parts = msg.payload.parts ?? [];
  const textPart = parts.find((p) => p.mimeType === "text/plain");
  if (textPart?.body?.data) {
    return Buffer.from(textPart.body.data, "base64").toString("utf8");
  }
  if (msg.payload.body?.data) {
    return Buffer.from(msg.payload.body.data, "base64").toString("utf8");
  }
  return "";
}

async function fetchGmailAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Gmail attachment fetch failed: ${res.status}`);
  const data = (await res.json()) as { data?: string };
  // Gmail returns the bytes base64url-encoded; normalise to standard base64 for
  // the ingest path (which decodes with Buffer.from(dataBase64, "base64")).
  return Buffer.from(data.data ?? "", "base64url").toString("base64");
}

async function extractGmailAttachments(
  accessToken: string,
  msg: GmailMessage,
  log: typeof logger,
): Promise<Array<{ filename: string; mimeType: string; size: number; data: string }>> {
  // format=full returns only an attachmentId per part — the bytes must be
  // fetched separately via users.messages.attachments.get.
  const parts = (msg.payload.parts ?? []).filter((p) => p.filename && p.body?.attachmentId);
  const out: Array<{ filename: string; mimeType: string; size: number; data: string }> = [];
  for (const p of parts) {
    try {
      const data = await fetchGmailAttachmentData(
        accessToken,
        msg.id,
        p.body.attachmentId as string,
      );
      out.push({ filename: p.filename, mimeType: p.mimeType, size: p.body.size ?? 0, data });
    } catch (err) {
      log.warn(
        { err, filename: p.filename, messageId: msg.id },
        "Gmail attachment fetch failed — skipping attachment",
      );
    }
  }
  return out;
}

export async function pollEmailAccountProcessor(job: Job<PollEmailAccountJobData>): Promise<void> {
  const { emailAccountId, orgId } = job.data;
  const log = logger.child({ emailAccountId, orgId, job: "poll-email-account" });

  const account = await db.query.emailAccounts.findFirst({
    where: (a, { eq }) => eq(a.id, emailAccountId),
  });

  if (!account || account.status !== "connected") {
    log.info("Account not found or not connected — skipping");
    return;
  }

  try {
    const accessToken = await getValidAccessToken(emailAccountId, account.provider);

    if (account.provider === "microsoft") {
      const messages = await fetchMicrosoftMessages(accessToken, account.lastCheckedAt);
      log.info({ count: messages.length }, "Fetched MS messages");

      for (const msg of messages) {
        const attachmentData = msg.hasAttachments
          ? await fetchMicrosoftAttachments(accessToken, msg.id)
          : [];

        const jobData: IngestEmailJobData = {
          emailAccountId,
          orgId,
          provider: "microsoft",
          providerMessageId: msg.id,
          providerThreadId: msg.conversationId,
          fromEmail: msg.from.emailAddress.address,
          fromName: msg.from.emailAddress.name,
          toEmails: msg.toRecipients.map((r) => r.emailAddress.address),
          subject: msg.subject,
          bodyText: msg.body.content,
          receivedAt: msg.receivedDateTime,
          attachments: attachmentData.map((a) => ({
            filename: a.name,
            contentType: a.contentType,
            sizeBytes: a.size,
            dataBase64: a.contentBytes,
          })),
        };

        await ingestEmailQueue.add(`ingest:${msg.id}`, jobData, {
          jobId: `ingest:${msg.id}`,
          removeOnComplete: 100,
          removeOnFail: 50,
        });
      }
    } else if (account.provider === "gmail") {
      const messageIds = await fetchGmailMessages(accessToken, account.lastCheckedAt);
      log.info({ count: messageIds.length }, "Fetched Gmail message IDs");

      for (const msgId of messageIds) {
        const msg = await fetchGmailMessage(accessToken, msgId);
        const gmailAttachments = await extractGmailAttachments(accessToken, msg, log);

        const jobData: IngestEmailJobData = {
          emailAccountId,
          orgId,
          provider: "gmail",
          providerMessageId: msg.id,
          providerThreadId: msg.threadId,
          fromEmail: getGmailHeader(msg, "From")
            .replace(/.*<(.+)>/, "$1")
            .trim(),
          fromName: getGmailHeader(msg, "From").replace(/<.*>/, "").trim(),
          toEmails: getGmailHeader(msg, "To")
            .split(",")
            .map((e) => e.replace(/.*<(.+)>/, "$1").trim()),
          subject: getGmailHeader(msg, "Subject"),
          bodyText: extractGmailText(msg),
          receivedAt: new Date(Number(msg.internalDate)).toISOString(),
          attachments: gmailAttachments.map((a) => ({
            filename: a.filename,
            contentType: a.mimeType,
            sizeBytes: a.size,
            dataBase64: a.data,
          })),
        };

        await ingestEmailQueue.add(`ingest:${msg.id}`, jobData, {
          jobId: `ingest:${msg.id}`,
          removeOnComplete: 100,
          removeOnFail: 50,
        });
      }
    }

    await emailAccountService.updateLastChecked(emailAccountId);
    await emailAccountService.updateStatus(emailAccountId, "connected");
  } catch (err) {
    log.error({ err }, "Poll failed");
    await emailAccountService.updateStatus(
      emailAccountId,
      "error",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}

// Type helpers
interface MsMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  body: { content: string; contentType: string };
  receivedDateTime: string;
  hasAttachments: boolean;
}

interface MsAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes: string; // base64
  isInline: boolean;
}

interface GmailMessage {
  id: string;
  threadId: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body: { data?: string; size?: number; attachmentId?: string };
    parts?: Array<{
      mimeType: string;
      filename: string;
      body: { data?: string; size?: number; attachmentId?: string };
    }>;
  };
}
