import "server-only";
import { Queue } from "bullmq";
import { partService } from "@uptool/services";

// Producer side of the CAD-thumbnail pipeline. The worker (apps/worker) owns the
// consumer + the actual headless render. Queue name / job-data shape must stay in
// sync with apps/worker/src/queues.ts (RENDER_CAD_THUMBNAIL).
const QUEUE_NAME = "render-cad-thumbnail";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};

// One Queue per server process. globalThis cache survives dev hot-reloads so we
// don't leak Redis connections on every recompile.
const g = globalThis as unknown as { __cadThumbQueue?: Queue };
const queue = g.__cadThumbQueue ?? new Queue(QUEUE_NAME, { connection });
if (process.env.NODE_ENV !== "production") g.__cadThumbQueue = queue;

interface EnqueueInput {
  orgId: string;
  partId: string;
  attachmentId: string;
  storageKey: string;
  filename: string;
}

async function enqueue(input: EnqueueInput): Promise<void> {
  await partService.markThumbnailPending(input.orgId, input.partId);
  // jobId keyed on part+attachment: re-enqueuing the same CAD is a no-op while a
  // render is in flight; a replaced CAD (new attachmentId) gets a fresh render.
  await queue.add(QUEUE_NAME, input, {
    jobId: `thumb:${input.partId}:${input.attachmentId}`,
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

/** Enqueue a single part's CAD render. No-op if the part has no CAD attachment. */
export async function enqueuePartThumbnail(orgId: string, partId: string): Promise<void> {
  const cad = await partService.findCadForPart(orgId, partId);
  if (!cad) return;
  await enqueue({
    orgId,
    partId,
    attachmentId: cad.id,
    storageKey: cad.storageKey,
    filename: cad.filename,
  });
}

/**
 * Idempotently enqueue renders for every part that has a CAD file but no usable
 * thumbnail (never rendered or last render failed). Safe to call on every page
 * load — dedup happens via jobId, and ready/pending parts are skipped at the DB.
 */
export async function ensureThumbnails(orgId: string, rfqId?: string): Promise<void> {
  const pending = await partService.findPartsNeedingThumbnail(orgId, rfqId);
  await Promise.all(
    pending.map((p) =>
      enqueue({
        orgId,
        partId: p.partId,
        attachmentId: p.attachmentId,
        storageKey: p.storageKey,
        filename: p.filename,
      }),
    ),
  );
}
