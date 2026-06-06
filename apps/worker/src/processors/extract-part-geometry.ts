import { extname } from "node:path";
import { type GeometryResult, estimateService, partService, storageService } from "@uptool/services";
import type { Job } from "bullmq";
import { extractDxfGeometry } from "../geometry/extract-dxf";
import { extractStepGeometry } from "../geometry/extract-step";
import { logger } from "../logger";
import type { ExtractPartGeometryJobData } from "../queues";

const STEP_EXTS = new Set([".step", ".stp", ".iges", ".igs"]);

export async function extractPartGeometryProcessor(
  job: Job<ExtractPartGeometryJobData>,
): Promise<void> {
  const { orgId, partId, storageKey, filename } = job.data;
  const ext = extname(filename).toLowerCase();
  const log = logger.child({ orgId, partId, ext, job: "extract-part-geometry" });

  try {
    await partService.markGeometryProcessing(orgId, partId);
    const { body } = await storageService.download(storageKey);

    let result: GeometryResult;
    if (STEP_EXTS.has(ext)) {
      result = await extractStepGeometry(body, ext);
    } else if (ext === ".dxf") {
      result = extractDxfGeometry(body);
    } else {
      // Unsupported (e.g. .dwg/.stl) — mark ready with no geometry so it isn't
      // re-enqueued forever; refine support later if needed.
      log.info("Unsupported geometry extension — marking ready with nulls");
      await partService.markGeometryReady(orgId, partId, {});
      return;
    }

    await partService.markGeometryReady(orgId, partId, result);
    log.info({ result }, "Geometry extracted");

    // If the estimator opened this part before extraction finished, its operations
    // were seeded without formula times. Backfill the untouched formula ops now
    // (no-op if not yet hydrated or the estimator has already edited them).
    await estimateService
      .rehydrateFormulaTimes(orgId, partId)
      .catch((err) => log.warn({ err }, "rehydrateFormulaTimes failed"));
  } catch (err) {
    // Isolated to this part — mark retryable and surface for the failed-job log.
    log.error({ err }, "Geometry extraction failed");
    await partService
      .markGeometryFailed(orgId, partId, err instanceof Error ? err.message : String(err))
      .catch(() => {});
    throw err;
  }
}
