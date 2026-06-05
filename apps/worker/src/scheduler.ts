import { db } from "@uptool/db";
import { syncAccountPolls } from "@uptool/services";
import { logger } from "./logger";

// On startup, reconcile BullMQ repeatable poll schedulers with the set of connected
// email accounts: one repeatable job per account, orphaned schedulers dropped.
// BullMQ's native repeat then fires each account's poll on its own interval —
// runtime connect/disconnect (de)register their schedulers via emailAccountService.
export async function syncEmailPollSchedulers(): Promise<void> {
  const accounts = await db.query.emailAccounts.findMany({
    where: (a, { eq }) => eq(a.status, "connected"),
  });

  const count = await syncAccountPolls(accounts.map((a) => ({ id: a.id, orgId: a.orgId })));

  if (count > 0) {
    logger.info({ count }, "Registered repeatable email poll schedulers");
  }
}
