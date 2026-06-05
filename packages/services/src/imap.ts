import { decrypt } from "@uptool/shared/crypto";
import { ImapFlow, type SearchObject } from "imapflow";
import { type AddressObject, type ParsedMail, simpleParser } from "mailparser";
import { emailAccountService } from "./email-account";
import { emailIngestService, type IngestPayload } from "./email-ingest";

// Bound every IMAP attempt so a wrong host / silent server can't hang a poll or
// a connection test. MVP polls on an interval — no persistent IDLE connection.
const IMAP_TIMEOUT_MS = 10_000;

export interface ImapConfig {
  email: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  password: string;
}

/** Thrown when an IMAP LOGIN can't be established (bad host/port/credentials/timeout). */
export class ImapConnectionError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ImapConnectionError";
  }
}

function buildClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapTls,
    auth: { user: config.email, pass: config.password },
    logger: false,
    greetingTimeout: IMAP_TIMEOUT_MS,
    connectionTimeout: IMAP_TIMEOUT_MS,
    socketTimeout: IMAP_TIMEOUT_MS,
  });
}

/**
 * Attempt an IMAP LOGIN and immediately disconnect. Throws ImapConnectionError on
 * any failure. Called BEFORE persisting credentials — never save if this throws.
 */
export async function testImapConnection(config: ImapConfig): Promise<void> {
  const client = buildClient(config);
  try {
    await client.connect(); // performs the LOGIN handshake
  } catch (err) {
    throw new ImapConnectionError(
      err instanceof Error ? err.message : "IMAP connection failed",
      err,
    );
  } finally {
    await client.logout().catch(() => {});
  }
}

type ImapAccount = {
  id: string;
  orgId: string;
  email: string;
  imapHost: string | null;
  imapPort: number | null;
  imapTls: boolean;
  imapPassword: string | null;
  lastCheckedAt: Date | null;
};

function addressList(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  const objs = Array.isArray(addr) ? addr : [addr];
  return objs.flatMap((o) => o.value.map((v) => v.address ?? "")).filter(Boolean);
}

/** Pure mapping: a parsed MIME message → the shared ingest payload (provider 'imap'). */
export function buildImapPayload(account: ImapAccount, parsed: ParsedMail): IngestPayload {
  const from = parsed.from?.value?.[0];
  const messageId = parsed.messageId ?? `imap-${account.id}-${parsed.date?.getTime() ?? ""}`;
  const refs = parsed.references;
  const threadId = (Array.isArray(refs) ? refs[0] : refs) ?? messageId;

  return {
    orgId: account.orgId,
    emailAccountId: account.id,
    provider: "imap",
    providerMessageId: messageId,
    providerThreadId: threadId,
    fromEmail: from?.address ?? "",
    fromName: from?.name || undefined,
    toEmails: addressList(parsed.to),
    subject: parsed.subject ?? undefined,
    bodyText: parsed.text ?? undefined,
    receivedAt: parsed.date ?? new Date(),
    attachments: (parsed.attachments ?? []).map((a) => ({
      filename: a.filename ?? "attachment",
      contentType: a.contentType ?? "application/octet-stream",
      sizeBytes: a.size ?? a.content.length,
      data: a.content,
    })),
  };
}

/**
 * Poll one IMAP account: fetch UNSEEN INBOX messages (since last_checked_at on
 * subsequent polls), parse + ingest each via the shared pipeline, mark them
 * \Seen so they aren't refetched, then update status. Closes the connection on
 * exit — no persistent IDLE connection for MVP. Mirrors the Gmail/Microsoft
 * adapters' status handling.
 */
export async function pollImapMailbox(account: ImapAccount): Promise<void> {
  if (!account.imapHost || !account.imapPort || !account.imapPassword) {
    throw new Error(`IMAP account ${account.id} is missing connection settings`);
  }

  const client = buildClient({
    email: account.email,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapTls: account.imapTls,
    password: decrypt(account.imapPassword),
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const search: SearchObject = account.lastCheckedAt
        ? { seen: false, since: account.lastCheckedAt }
        : { seen: false };
      const uids = (await client.search(search, { uid: true })) || [];

      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        await emailIngestService.ingestMessage(buildImapPayload(account, parsed));
        // Mark seen only after a successful ingest, so a crash mid-ingest leaves
        // the message UNSEEN and it is retried next poll.
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }

    await emailAccountService.updateLastChecked(account.id);
    await emailAccountService.updateStatus(account.id, "connected");
  } catch (err) {
    await emailAccountService.updateStatus(
      account.id,
      "error",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  } finally {
    await client.logout().catch(() => {});
  }
}
