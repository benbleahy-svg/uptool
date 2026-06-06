import { attachments, db, partOperations, parts } from "@uptool/db";
import { type PairingResult, buildPartGroups, needsAiPairing } from "@uptool/shared";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { pairAttachmentsWithClaude } from "./part-grouping-ai";

export const DEFAULT_QUANTITY_BREAKS = [1, 10, 100] as const;

export interface CreatePartInput {
  orgId: string;
  rfqId: string;
  partNumber?: string;
  revision?: string;
  description?: string;
  material?: string;
  finish?: string;
  processType?: string;
  materialCostCents?: number;
}

export interface CreateOperationInput {
  orgId: string;
  partId: string;
  name: string;
  operationType?: "machining" | "expense";
  setupMinutes?: number;
  runMinutes?: number;
  hourlyRateCents?: number;
  isNonRecurring?: boolean;
}

export interface CostAtQty {
  quantity: number;
  costPerUnitCents: number;
}

/** Extracted geometry written by markGeometryReady. STEP files populate the bbox /
 *  volume / surface-area fields; DXF files populate cutLength / pierce / bend. Only
 *  the fields the extractor produced are set — omitted keys are left untouched. */
export interface GeometryResult {
  bboxXMm?: number | null;
  bboxYMm?: number | null;
  bboxZMm?: number | null;
  volumeMm3?: number | null;
  surfaceAreaMm2?: number | null;
  cutLengthMm?: number | null;
  pierceCount?: number | null;
  bendCount?: number | null;
}

export const partService = {
  async create(input: CreatePartInput) {
    const [part] = await db
      .insert(parts)
      .values({
        orgId: input.orgId,
        rfqId: input.rfqId,
        partNumber: input.partNumber,
        revision: input.revision,
        description: input.description,
        material: input.material,
        finish: input.finish,
        processType: input.processType,
        materialCostCents: input.materialCostCents ?? 0,
      })
      .returning();
    if (!part) throw new Error("Failed to create part");
    return part;
  },

  async update(
    orgId: string,
    partId: string,
    data: Partial<Omit<CreatePartInput, "orgId" | "rfqId">>,
  ) {
    const [part] = await db
      .update(parts)
      .set({
        partNumber: data.partNumber,
        revision: data.revision,
        description: data.description,
        material: data.material,
        finish: data.finish,
        materialCostCents: data.materialCostCents,
      })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)))
      .returning();
    return part;
  },

  async delete(orgId: string, partId: string) {
    await db.delete(parts).where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  /**
   * Auto-create parts from an ingested RFQ's stored attachments. One part per CAD
   * file; drawing PDFs are paired to their CAD — for a single-CAD RFQ every PDF
   * links to it (no ambiguity), for multi-CAD RFQs Claude pairs them (stem-matching
   * fails when model and drawing carry different document numbers). part_number is
   * the title-cased stem and process_type comes from the primary extension; each
   * paired attachment gets part_id set.
   *
   * The parts/links run in one transaction so a partial failure rolls back cleanly.
   * The caller (ingest) wraps this in try/catch — a failure must NOT fail the
   * ingest, so the RFQ + attachments survive with no parts. Returns created part ids.
   */
  async createPartsFromAttachments(orgId: string, rfqId: string): Promise<string[]> {
    const files = await db
      .select({ id: attachments.id, filename: attachments.filename })
      .from(attachments)
      .where(and(eq(attachments.orgId, orgId), eq(attachments.rfqId, rfqId)));

    // Multi-CAD RFQs need Claude to pair PDFs to the right CAD. Best-effort: any
    // failure (no key, timeout, bad JSON) falls back to one part per CAD.
    let pairing: PairingResult | null = null;
    if (needsAiPairing(files)) {
      try {
        pairing = await pairAttachmentsWithClaude(files.map((f) => f.filename));
      } catch (err) {
        console.error(`[parts] Claude file pairing failed for rfq ${rfqId}:`, err);
        pairing = null;
      }
    }

    const groups = buildPartGroups(files, pairing);
    if (groups.length === 0) return [];

    return db.transaction(async (tx) => {
      const createdIds: string[] = [];
      let sortOrder = 1;
      for (const group of groups) {
        const [part] = await tx
          .insert(parts)
          .values({
            orgId,
            rfqId,
            partNumber: group.name,
            processType: group.processType,
            sortOrder,
          })
          .returning({ id: parts.id });
        if (!part) throw new Error("Failed to create part");
        createdIds.push(part.id);
        sortOrder += 1;

        await tx
          .update(attachments)
          .set({ partId: part.id })
          .where(
            and(eq(attachments.orgId, orgId), inArray(attachments.id, group.attachmentIds)),
          );
      }
      return createdIds;
    });
  },

  /**
   * Persist a part's No-Bid decision (mirrors the estimation UI's session state).
   * An RFQ where every part is no-bid derives as Declined (see getRfqStatus).
   */
  async setNoBid(orgId: string, partId: string, isNoBid: boolean) {
    await db
      .update(parts)
      .set({ isNoBid })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  /**
   * Mark a part's estimate finished (or reopen it). Persists the timestamp the
   * dashboard reads to show the green ✓ on the Parts column.
   */
  async setCompleted(orgId: string, partId: string, completed: boolean) {
    await db
      .update(parts)
      .set({ estimateCompletedAt: completed ? new Date() : null })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  async findByRfq(orgId: string, rfqId: string) {
    return db.query.parts.findMany({
      where: (p, { and, eq }) => and(eq(p.orgId, orgId), eq(p.rfqId, rfqId)),
      with: { operations: { orderBy: (o, { asc }) => [asc(o.sortOrder), asc(o.createdAt)] } },
      orderBy: (p, { asc }) => [asc(p.sortOrder), asc(p.createdAt)],
    });
  },

  async findForOrg(orgId: string, excludeRfqId: string) {
    return db.query.parts.findMany({
      where: (p, { and, eq, ne }) => and(eq(p.orgId, orgId), ne(p.rfqId, excludeRfqId)),
      with: {
        operations: { orderBy: (o, { asc }) => [asc(o.sortOrder), asc(o.createdAt)] },
        rfq: { columns: { rfqNumber: true, subject: true } },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit: 100,
    });
  },

  async copyOperations(orgId: string, fromPartId: string, toPartId: string) {
    const source = await db.query.parts.findFirst({
      where: (p, { and, eq }) => and(eq(p.id, fromPartId), eq(p.orgId, orgId)),
      with: { operations: true },
    });
    if (!source || source.operations.length === 0) return;

    await db.insert(partOperations).values(
      source.operations.map((op) => ({
        orgId,
        partId: toPartId,
        name: op.name,
        operationType: op.operationType,
        setupMinutes: op.setupMinutes,
        runMinutes: op.runMinutes,
        hourlyRateCents: op.hourlyRateCents,
        isNonRecurring: op.isNonRecurring,
      })),
    );
  },

  async addOperation(input: CreateOperationInput) {
    const [op] = await db
      .insert(partOperations)
      .values({
        orgId: input.orgId,
        partId: input.partId,
        name: input.name,
        operationType: input.operationType ?? "machining",
        setupMinutes: String(input.setupMinutes ?? 0),
        runMinutes: String(input.runMinutes ?? 0),
        hourlyRateCents: input.hourlyRateCents ?? 0,
        isNonRecurring: input.isNonRecurring ?? false,
      })
      .returning();
    if (!op) throw new Error("Failed to create operation");
    return op;
  },

  async updateOperation(
    orgId: string,
    operationId: string,
    data: Partial<Omit<CreateOperationInput, "orgId" | "partId">>,
  ) {
    const [op] = await db
      .update(partOperations)
      .set({
        name: data.name,
        setupMinutes: data.setupMinutes !== undefined ? String(data.setupMinutes) : undefined,
        runMinutes: data.runMinutes !== undefined ? String(data.runMinutes) : undefined,
        hourlyRateCents: data.hourlyRateCents,
        isNonRecurring: data.isNonRecurring,
      })
      .where(and(eq(partOperations.id, operationId), eq(partOperations.orgId, orgId)))
      .returning();
    return op;
  },

  async deleteOperation(orgId: string, operationId: string) {
    await db
      .delete(partOperations)
      .where(and(eq(partOperations.id, operationId), eq(partOperations.orgId, orgId)));
  },

  async updatePartNotes(
    orgId: string,
    partId: string,
    notesExternal: string | null,
    notesInternal: string | null,
  ) {
    await db
      .update(parts)
      .set({ notesExternal, notesInternal })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  // ─── CAD thumbnail pipeline ──────────────────────────────────────────────
  // Thumbnails are rendered off the request path by the worker (see
  // apps/worker render-cad-thumbnail). status: null = no CAD linked,
  // 'pending' = render queued, 'ready' = thumbnailKey set, 'failed' = retryable.

  /** The CAD attachment linked to a part, if any. Used to build a render job. */
  async findCadForPart(orgId: string, partId: string) {
    return db.query.attachments.findFirst({
      where: (a, { and, eq }) =>
        and(eq(a.orgId, orgId), eq(a.partId, partId), eq(a.category, "cad")),
      columns: { id: true, storageKey: true, filename: true },
    });
  },

  /**
   * Parts that have a CAD file but no usable thumbnail yet (never rendered or
   * the last render failed). Drives idempotent enqueue-on-load + retry.
   */
  async findPartsNeedingThumbnail(orgId: string, rfqId?: string) {
    const rows = await db
      .select({
        partId: parts.id,
        attachmentId: attachments.id,
        storageKey: attachments.storageKey,
        filename: attachments.filename,
      })
      .from(parts)
      .innerJoin(
        attachments,
        and(eq(attachments.partId, parts.id), eq(attachments.category, "cad")),
      )
      .where(
        and(
          eq(parts.orgId, orgId),
          rfqId ? eq(parts.rfqId, rfqId) : undefined,
          or(isNull(parts.thumbnailStatus), eq(parts.thumbnailStatus, "failed")),
        ),
      );
    return rows;
  },

  async markThumbnailPending(orgId: string, partId: string) {
    await db
      .update(parts)
      .set({ thumbnailStatus: "pending" })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  async markThumbnailReady(orgId: string, partId: string, thumbnailKey: string) {
    await db
      .update(parts)
      .set({ thumbnailStatus: "ready", thumbnailKey })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  async markThumbnailFailed(orgId: string, partId: string) {
    await db
      .update(parts)
      .set({ thumbnailStatus: "failed" })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  // ─── CAD geometry extraction pipeline ────────────────────────────────────
  // Geometry is extracted off the request path by the worker (see apps/worker
  // extract-part-geometry). status: null = not extracted, 'pending' = queued,
  // 'processing' = job running, 'ready' = numbers written, 'failed' = retryable.

  /**
   * Parts that have a CAD/DXF file but no usable geometry yet (never extracted or
   * the last extraction failed). Drives idempotent enqueue-on-load + retry. Mirrors
   * findPartsNeedingThumbnail; the producer derives the extension from `filename`.
   */
  async findPartsNeedingGeometry(orgId: string, rfqId?: string) {
    return db
      .select({
        partId: parts.id,
        attachmentId: attachments.id,
        storageKey: attachments.storageKey,
        filename: attachments.filename,
      })
      .from(parts)
      .innerJoin(
        attachments,
        and(eq(attachments.partId, parts.id), eq(attachments.category, "cad")),
      )
      .where(
        and(
          eq(parts.orgId, orgId),
          rfqId ? eq(parts.rfqId, rfqId) : undefined,
          or(isNull(parts.geometryStatus), eq(parts.geometryStatus, "failed")),
        ),
      );
  },

  async markGeometryPending(orgId: string, partId: string) {
    await db
      .update(parts)
      .set({ geometryStatus: "pending" })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  async markGeometryProcessing(orgId: string, partId: string) {
    await db
      .update(parts)
      .set({ geometryStatus: "processing" })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  /** Persist extracted geometry (only the fields the extractor produced) and mark
   *  the part 'ready'. STEP yields bbox/volume/surface area; DXF yields cut length
   *  + pierce/bend counts. Unsupported files mark ready with all-null geometry. */
  async markGeometryReady(orgId: string, partId: string, result: GeometryResult) {
    await db
      .update(parts)
      .set({
        geometryStatus: "ready",
        geometryExtractedAt: new Date(),
        ...(result.bboxXMm !== undefined && { geometryBboxXMm: result.bboxXMm }),
        ...(result.bboxYMm !== undefined && { geometryBboxYMm: result.bboxYMm }),
        ...(result.bboxZMm !== undefined && { geometryBboxZMm: result.bboxZMm }),
        ...(result.volumeMm3 !== undefined && { geometryVolumeMm3: result.volumeMm3 }),
        ...(result.surfaceAreaMm2 !== undefined && {
          geometrySurfaceAreaMm2: result.surfaceAreaMm2,
        }),
        ...(result.cutLengthMm !== undefined && { geometryCutLengthMm: result.cutLengthMm }),
        ...(result.pierceCount !== undefined && { geometryPierceCount: result.pierceCount }),
        ...(result.bendCount !== undefined && { geometryBendCount: result.bendCount }),
      })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  /** Mark extraction failed. `reason` is logged by the caller; there is no error
   *  column, so only the status is persisted (the part stays retryable). */
  async markGeometryFailed(orgId: string, partId: string, _reason?: string) {
    await db
      .update(parts)
      .set({ geometryStatus: "failed" })
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
  },

  computeCostsForPart(
    part: { materialCostCents: number },
    operations: Array<{
      setupMinutes: string | number;
      runMinutes: string | number;
      hourlyRateCents: number;
      isNonRecurring: boolean;
    }>,
    quantities: readonly number[],
  ): CostAtQty[] {
    return quantities.map((qty) => {
      let totalCents = part.materialCostCents;

      for (const op of operations) {
        const setup = Number(op.setupMinutes);
        const run = Number(op.runMinutes);
        const rate = op.hourlyRateCents;

        if (op.isNonRecurring) {
          // One-time cost: setup + run (run_minutes treated as total for the batch)
          totalCents += Math.round(((setup + run) / 60) * rate);
        } else {
          // setup is one-time, run is per-unit
          const setupCost = Math.round((setup / 60) * rate);
          const runCost = Math.round((run / 60) * rate * qty);
          totalCents += Math.round((setupCost + runCost) / qty);
        }
      }

      return { quantity: qty, costPerUnitCents: Math.max(0, totalCents) };
    });
  },
};
