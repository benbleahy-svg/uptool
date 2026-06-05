import { pollImapMailbox } from "@uptool/services";
import type { logger } from "../logger";

type EmailAccountRow = {
  id: string;
  orgId: string;
  email: string;
  imapHost: string | null;
  imapPort: number | null;
  imapTls: boolean;
  imapPassword: string | null;
  lastCheckedAt: Date | null;
};

// Thin worker adapter. The orchestration (connect, fetch UNSEEN, parse, ingest,
// mark \Seen, update status) lives in @uptool/services `pollImapMailbox` so it is
// unit-testable with the services test harness. This dispatches and logs.
export async function pollImapAccount(
  account: EmailAccountRow,
  log: typeof logger,
): Promise<void> {
  log.info("Polling IMAP account");
  await pollImapMailbox(account);
  log.info("IMAP poll complete");
}
