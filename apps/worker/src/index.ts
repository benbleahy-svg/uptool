import { Worker } from "bullmq";
import {
  connection,
  helloWorldQueue,
  QUEUE_NAMES,
} from "./queues";
import { helloWorldProcessor } from "./processors/hello-world";
import { pollEmailAccountProcessor } from "./processors/poll-email-account";
import { ingestEmailProcessor } from "./processors/ingest-email";
import { scheduleEmailPolls } from "./scheduler";
import { logger } from "./logger";

const helloWorker = new Worker(QUEUE_NAMES.HELLO_WORLD, helloWorldProcessor, { connection });
const pollWorker = new Worker(QUEUE_NAMES.POLL_EMAIL_ACCOUNT, pollEmailAccountProcessor, {
  connection,
  concurrency: 5,
});
const ingestWorker = new Worker(QUEUE_NAMES.INGEST_EMAIL, ingestEmailProcessor, {
  connection,
  concurrency: 10,
});

for (const [worker, name] of [
  [helloWorker, QUEUE_NAMES.HELLO_WORLD],
  [pollWorker, QUEUE_NAMES.POLL_EMAIL_ACCOUNT],
  [ingestWorker, QUEUE_NAMES.INGEST_EMAIL],
] as const) {
  worker.on("completed", (job) => logger.info({ jobId: job.id, queue: name }, "Job completed"));
  worker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, queue: name, err }, "Job failed"),
  );
}

logger.info("Worker started — listening for jobs");

// Startup: verify wiring + schedule initial email polls
helloWorldQueue
  .add("startup-check", {})
  .then((job) => logger.info({ jobId: job.id }, "Startup check job queued"))
  .catch((err) => logger.error({ err }, "Failed to queue startup check"));

// Schedule email polls immediately and every 5 minutes
scheduleEmailPolls().catch((err) => logger.error({ err }, "Initial schedule failed"));
const POLL_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  scheduleEmailPolls().catch((err) => logger.error({ err }, "Scheduled poll failed"));
}, POLL_INTERVAL_MS);

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down worker");
  await Promise.all([helloWorker.close(), pollWorker.close(), ingestWorker.close()]);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
