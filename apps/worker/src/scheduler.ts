import { db } from "@uptool/db";
import { pollEmailAccountQueue } from "./queues";
import { logger } from "./logger";

// Enqueue a PollEmailAccount job for every connected email account.
// Called on startup and every 5 minutes via setInterval.
export async function scheduleEmailPolls(): Promise<void> {
  const accounts = await db.query.emailAccounts.findMany({
    where: (a, { eq }) => eq(a.status, "connected"),
  });

  for (const account of accounts) {
    await pollEmailAccountQueue.add(
      `poll:${account.id}`,
      { emailAccountId: account.id, orgId: account.orgId },
      {
        jobId: `poll-${account.id}`,
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
  }

  if (accounts.length > 0) {
    logger.info({ count: accounts.length }, "Scheduled email poll jobs");
  }
}
