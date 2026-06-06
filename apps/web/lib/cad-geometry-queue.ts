import "server-only";
import { partService } from "@uptool/services";
import { Queue } from "bullmq";

// Producer side of the geometry-extraction pipeline. The worker (apps/worker) owns
// the consumer + the actual occt/DXF extraction. Queue name / job-data shape must
// stay in sync with apps/worker/src/queues.ts (EXTRACT_PART_GEOMETRY). Mirrors
// cad-thumbnail-queue.ts.
const QUEUE_NAME = "extract-part-geometry";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};

// One Queue per server process. globalThis cache survives dev hot-reloads so we
// don't leak Redis connections on every recompile.
const g = globalThis as unknown as { __cadGeomQueue?: Queue };
const queue = g.__cadGeomQueue ?? new Queue(QUEUE_NAME, { connection });
if (process.env.NODE_ENV !== "production") g.__cadGeomQueue = queue;

interface EnqueueInput {
  orgId: string;
  partId: string;
  attachmentId: string;
  storageKey: string;
  filename: string;
}

async function enqueue(input: EnqueueInput): Promise<void> {
  await partService.markGeometryPending(input.orgId, input.partId);
  // jobId keyed on part+attachment: re-enqueuing the same CAD is a no-op while
  // extraction is in flight; a replaced CAD (new attachmentId) gets a fresh run.
  await queue.add(QUEUE_NAME, input, {
    jobId: `geom:${input.partId}:${input.attachmentId}`,
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

/** Enqueue a single part's geometry extraction. No-op if the part has no CAD/DXF. */
export async function enqueuePartGeometry(orgId: string, partId: string): Promise<void> {
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
 * Idempotently enqueue extraction for every part that has a CAD/DXF file but no
 * usable geometry (never extracted or last extraction failed). Safe to call on
 * every page load — dedup via jobId, and ready/pending parts are skipped at the DB.
 */
export async function ensureGeometry(orgId: string, rfqId?: string): Promise<void> {
  const pending = await partService.findPartsNeedingGeometry(orgId, rfqId);
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
