import { Queue } from "bullmq";

// Poll cadence for connected email accounts. Single source of truth; override via
// the POLL_INTERVAL_MS env var (e.g. shorten it in tests / local verification).
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000;

// Producer/scheduler side. The worker (apps/worker) owns the consumer. Queue name
// must stay in sync with apps/worker/src/queues.ts QUEUE_NAMES.POLL_EMAIL_ACCOUNT.
const QUEUE_NAME = "poll-email-account";

const SCHEDULER_PREFIX = "poll-account-";
const schedulerId = (emailAccountId: string) => `${SCHEDULER_PREFIX}${emailAccountId}`;

// One Queue per process, cached on globalThis so dev hot-reloads don't leak Redis
// connections. Created lazily so merely importing @uptool/services never opens a
// connection — only (de)registering a poll does.
function getQueue(): Queue {
  const g = globalThis as unknown as { __pollEmailQueue?: Queue };
  if (g.__pollEmailQueue) return g.__pollEmailQueue;
  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  const queue = new Queue(QUEUE_NAME, {
    connection: { host: redisUrl.hostname, port: Number(redisUrl.port) || 6379 },
  });
  g.__pollEmailQueue = queue;
  return queue;
}

/**
 * Register (or refresh) a BullMQ repeatable job that polls one connected account
 * every POLL_INTERVAL_MS. Idempotent: upserting an existing scheduler just updates
 * it. This is the native repeat primitive — no setInterval + manual re-add (which
 * dedup'd on a static jobId and stopped polling after the first tick).
 */
export async function registerAccountPoll(emailAccountId: string, orgId: string): Promise<void> {
  await getQueue().upsertJobScheduler(
    schedulerId(emailAccountId),
    { every: POLL_INTERVAL_MS },
    {
      name: "poll",
      data: { emailAccountId, orgId },
      opts: { removeOnComplete: 100, removeOnFail: 50 },
    },
  );
}

/** Cancel an account's repeatable poll (on disconnect / removal). Idempotent. */
export async function cancelAccountPoll(emailAccountId: string): Promise<void> {
  await getQueue().removeJobScheduler(schedulerId(emailAccountId));
}

/**
 * Reconcile repeatable poll schedulers with the given set of connected accounts:
 * register one per account and drop schedulers whose account is no longer
 * connected (e.g. disconnected while the worker was down). Called on worker startup.
 */
export async function syncAccountPolls(
  accounts: Array<{ id: string; orgId: string }>,
): Promise<number> {
  const queue = getQueue();
  for (const a of accounts) await registerAccountPoll(a.id, a.orgId);

  const wanted = new Set(accounts.map((a) => schedulerId(a.id)));
  const existing = await queue.getJobSchedulers();
  for (const s of existing) {
    if (s.key.startsWith(SCHEDULER_PREFIX) && !wanted.has(s.key)) {
      await queue.removeJobScheduler(s.key);
    }
  }
  return accounts.length;
}
