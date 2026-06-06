import { Worker } from "bullmq";
import {
  connection,
  helloWorldQueue,
  QUEUE_NAMES,
} from "./queues";
import { helloWorldProcessor } from "./processors/hello-world";
import { pollEmailAccountProcessor } from "./processors/poll-email-account";
import { ingestEmailProcessor } from "./processors/ingest-email";
import { extractPartGeometryProcessor } from "./processors/extract-part-geometry";
import {
  closeRenderer,
  renderCadThumbnailProcessor,
} from "./processors/render-cad-thumbnail";
import { syncEmailPollSchedulers } from "./scheduler";
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
// Capped concurrency: each render holds a headless browser page + WebGL context.
const renderCadWorker = new Worker(
  QUEUE_NAMES.RENDER_CAD_THUMBNAIL,
  renderCadThumbnailProcessor,
  { connection, concurrency: 2 },
);
// Geometry extraction is pure WASM/CPU (occt) or DXF parsing — no browser, so it
// can run a bit wider than the rendering worker.
const extractGeometryWorker = new Worker(
  QUEUE_NAMES.EXTRACT_PART_GEOMETRY,
  extractPartGeometryProcessor,
  { connection, concurrency: 4 },
);

for (const [worker, name] of [
  [helloWorker, QUEUE_NAMES.HELLO_WORLD],
  [pollWorker, QUEUE_NAMES.POLL_EMAIL_ACCOUNT],
  [ingestWorker, QUEUE_NAMES.INGEST_EMAIL],
  [renderCadWorker, QUEUE_NAMES.RENDER_CAD_THUMBNAIL],
  [extractGeometryWorker, QUEUE_NAMES.EXTRACT_PART_GEOMETRY],
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

// Register BullMQ repeatable poll schedulers for connected accounts. BullMQ's
// repeat mechanism fires each account's poll every POLL_INTERVAL_MS — no manual
// setInterval re-add (which dedup'd on a static jobId and stopped after one tick).
syncEmailPollSchedulers().catch((err) => logger.error({ err }, "Failed to sync poll schedulers"));

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down worker");
  await Promise.all([
    helloWorker.close(),
    pollWorker.close(),
    ingestWorker.close(),
    renderCadWorker.close(),
    extractGeometryWorker.close(),
  ]);
  await closeRenderer();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
