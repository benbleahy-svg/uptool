import { extname } from "node:path";
import { partService, storageService } from "@uptool/services";
import type { Job } from "bullmq";
import { CadRenderer } from "../cad-render/renderer";
import type { RenderCadThumbnailJobData } from "../queues";
import { logger } from "../logger";

// One Chromium + render server shared across all jobs on this worker. Launched
// lazily on the first job so the worker starts fast and pays the cost only if
// CAD actually needs rendering. Closed on shutdown (see index.ts).
let renderer: CadRenderer | null = null;
let initPromise: Promise<CadRenderer> | null = null;

async function getRenderer(): Promise<CadRenderer> {
  if (renderer) return renderer;
  if (!initPromise) {
    const r = new CadRenderer();
    initPromise = r.init().then(() => {
      renderer = r;
      return r;
    });
  }
  return initPromise;
}

export async function closeRenderer(): Promise<void> {
  if (renderer) {
    await renderer.close();
    renderer = null;
    initPromise = null;
  }
}

export async function renderCadThumbnailProcessor(
  job: Job<RenderCadThumbnailJobData>,
): Promise<void> {
  const { orgId, partId, storageKey, filename } = job.data;
  const log = logger.child({ orgId, partId, job: "render-cad-thumbnail" });

  try {
    const { body } = await storageService.download(storageKey);
    const ext = extname(filename).toLowerCase() || ".step";

    const r = await getRenderer();
    // A hung render must never wedge the worker — the renderer kills the page
    // context at the timeout and we fall through to the failure path.
    const png = await r.render(body, ext);

    const thumbKey = `${orgId}/thumbnails/${partId}.png`;
    await storageService.upload(thumbKey, png, "image/png");
    await partService.markThumbnailReady(orgId, partId, thumbKey);
    log.info({ thumbKey, bytes: png.length }, "Thumbnail rendered");
  } catch (err) {
    // Failure is isolated to this part — mark it retryable and surface the error
    // for BullMQ's failed-job log without taking down the worker.
    log.error({ err }, "Thumbnail render failed");
    await partService.markThumbnailFailed(orgId, partId).catch(() => {});
    throw err;
  }
}
