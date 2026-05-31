import { attachments, db, partOperations, parts } from "@uptool/db";
import { and, eq, isNull, or } from "drizzle-orm";

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
