// Estimate persistence — the write path for the calculator (operations,
// materials, notes, RFQ-level quote bulk). Org-scoped on every query; multi-step
// writes run in a transaction. Last-write-wins (no version column) — documented
// limitation. Pure services module: no Next.js / React imports. See ADR 0019.

import { db, partMaterials, partOperations, parts, rfqs } from "@uptool/db";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  DEFAULT_HOURLY_RATE_CENTS,
  buildDefaultMaterials,
  buildDefaultOperations,
} from "./defaults";
import { NotFoundError, ValidationError } from "./errors";
import {
  type AddMaterialInput,
  type AddOperationInput,
  type NotesInput,
  type OverrideField,
  type QuoteBulkInput,
  type UpdateMaterialInput,
  type UpdateOperationInput,
  addMaterialSchema,
  addOperationSchema,
  notesSchema,
  overrideFieldSchema,
  parseOrThrow,
  quoteBulkSchema,
  reorderSchema,
  updateMaterialSchema,
  updateOperationSchema,
} from "./schemas";

export type PartOperation = typeof partOperations.$inferSelect;
export type PartMaterial = typeof partMaterials.$inferSelect;

/** Throws NotFoundError if the part doesn't exist for this org (also the cross-org guard). */
async function assertPartInOrg(orgId: string, partId: string): Promise<void> {
  const part = await db.query.parts.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.id, partId), e(t.orgId, orgId)),
    columns: { id: true },
  });
  if (!part) throw new NotFoundError("Part not found");
}

/** Next sort_order for a part's operations/materials (append to the end). */
async function nextSortOrder(
  table: typeof partOperations | typeof partMaterials,
  orgId: string,
  partId: string,
): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${table.sortOrder})` })
    .from(table)
    .where(and(eq(table.orgId, orgId), eq(table.partId, partId)));
  return Number(row?.max ?? -1) + 1;
}

export const estimateService = {
  // ─── 2.1 Hydration ─────────────────────────────────────────────────────────

  /**
   * Seed the calculator defaults into the DB the first time a part is opened.
   * Idempotent: if parts.estimateHydratedAt is already set, this is a no-op.
   * Runs in one transaction with a row lock so concurrent first-opens can't
   * double-seed. The caller queries fresh state separately.
   */
  async hydratePartEstimate(orgId: string, partId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [part] = await tx
        .select({ id: parts.id, hydratedAt: parts.estimateHydratedAt })
        .from(parts)
        .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)))
        .for("update");
      if (!part) throw new NotFoundError("Part not found");
      if (part.hydratedAt) return; // already hydrated → no-op

      const ops = buildDefaultOperations();
      if (ops.length > 0) {
        await tx.insert(partOperations).values(
          ops.map((o) => ({
            orgId,
            partId,
            name: o.name,
            operationType: o.operationType,
            setupMinutes: o.setupMinutes,
            runMinutes: o.runMinutes,
            hourlyRateCents: o.hourlyRateCents,
            isNonRecurring: o.isNonRecurring,
            sortOrder: o.sortOrder,
          })),
        );
      }

      const mats = buildDefaultMaterials();
      if (mats.length > 0) {
        await tx.insert(partMaterials).values(
          mats.map((m) => ({
            orgId,
            partId,
            materialType: m.materialType,
            fields: m.fields,
            sortOrder: m.sortOrder,
          })),
        );
      }

      await tx
        .update(parts)
        .set({ estimateHydratedAt: new Date() })
        .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)));
    });
  },

  // ─── 2.2 Operations CRUD ─────────────────────────────────────────────────────

  async listPartOperations(orgId: string, partId: string): Promise<PartOperation[]> {
    return db
      .select()
      .from(partOperations)
      .where(and(eq(partOperations.orgId, orgId), eq(partOperations.partId, partId)))
      .orderBy(asc(partOperations.sortOrder), asc(partOperations.createdAt));
  },

  async addPartOperation(
    orgId: string,
    partId: string,
    input: AddOperationInput,
  ): Promise<PartOperation> {
    const data = parseOrThrow(addOperationSchema, input);
    await assertPartInOrg(orgId, partId);
    const sortOrder = data.sortOrder ?? (await nextSortOrder(partOperations, orgId, partId));
    const [op] = await db
      .insert(partOperations)
      .values({
        orgId,
        partId,
        name: data.name,
        operationType: data.operationType ?? "machining",
        setupMinutes: String(data.setupMinutes ?? 0),
        runMinutes: String(data.runMinutes ?? 0),
        hourlyRateCents: data.hourlyRateCents ?? DEFAULT_HOURLY_RATE_CENTS,
        isNonRecurring: data.isNonRecurring ?? false,
        sortOrder,
        // An explicitly-added operation is user-created, not a seeded default.
        userTouched: true,
      })
      .returning();
    if (!op) throw new Error("Failed to add operation");
    return op;
  },

  /**
   * Patch an operation. Only provided fields are written. Any field here is
   * user-controlled, so a non-empty patch flips user_touched = true.
   */
  async updatePartOperation(
    orgId: string,
    operationId: string,
    patch: UpdateOperationInput,
  ): Promise<PartOperation> {
    const data = parseOrThrow(updateOperationSchema, patch);
    const set: Record<string, unknown> = {};
    if (data.name !== undefined) set.name = data.name;
    if (data.setupMinutes !== undefined) set.setupMinutes = String(data.setupMinutes);
    if (data.runMinutes !== undefined) set.runMinutes = String(data.runMinutes);
    if (data.isNonRecurring !== undefined) set.isNonRecurring = data.isNonRecurring;
    if (data.unitPriceOverrideCents !== undefined)
      set.unitPriceOverrideCents = data.unitPriceOverrideCents;
    if (data.markupPct !== undefined)
      set.markupPct = data.markupPct === null ? null : String(data.markupPct);
    if (data.setupRateCents !== undefined) set.setupRateCents = data.setupRateCents;
    if (data.runtimeRateCents !== undefined) set.runtimeRateCents = data.runtimeRateCents;
    if (data.volumeDiscountTiers !== undefined) set.volumeDiscountTiers = data.volumeDiscountTiers;

    if (Object.keys(set).length === 0) {
      const [cur] = await db
        .select()
        .from(partOperations)
        .where(and(eq(partOperations.id, operationId), eq(partOperations.orgId, orgId)));
      if (!cur) throw new NotFoundError("Operation not found");
      return cur;
    }

    set.userTouched = true;
    const [op] = await db
      .update(partOperations)
      .set(set)
      .where(and(eq(partOperations.id, operationId), eq(partOperations.orgId, orgId)))
      .returning();
    if (!op) throw new NotFoundError("Operation not found");
    return op;
  },

  async deletePartOperation(orgId: string, operationId: string): Promise<void> {
    const deleted = await db
      .delete(partOperations)
      .where(and(eq(partOperations.id, operationId), eq(partOperations.orgId, orgId)))
      .returning({ id: partOperations.id });
    if (deleted.length === 0) throw new NotFoundError("Operation not found");
  },

  /** Re-sort a part's operations. orderedIds must be exactly that part's ops. */
  async reorderPartOperations(orgId: string, partId: string, orderedIds: string[]): Promise<void> {
    const ids = parseOrThrow(reorderSchema, orderedIds);
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: partOperations.id })
        .from(partOperations)
        .where(and(eq(partOperations.orgId, orgId), eq(partOperations.partId, partId)));
      const existingIds = new Set(existing.map((r) => r.id));
      if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
        throw new ValidationError("orderedIds must be exactly this part's operations");
      }
      for (const [i, id] of ids.entries()) {
        await tx
          .update(partOperations)
          .set({ sortOrder: i })
          .where(and(eq(partOperations.id, id), eq(partOperations.orgId, orgId)));
      }
    });
  },

  /**
   * Null out an override column. Leaves user_touched as-is (the user did touch
   * the row when they set the override — reverting doesn't undo that fact).
   */
  async clearPartOperationOverride(
    orgId: string,
    operationId: string,
    field: OverrideField,
  ): Promise<PartOperation> {
    const f = parseOrThrow(overrideFieldSchema, field);
    const set: Record<string, unknown> = {};
    if (f === "unitPriceOverride") set.unitPriceOverrideCents = null;
    else if (f === "markup") set.markupPct = null;
    else if (f === "setupRate") set.setupRateCents = null;
    else if (f === "runtimeRate") set.runtimeRateCents = null;
    else if (f === "volumeDiscount") set.volumeDiscountTiers = null;

    const [op] = await db
      .update(partOperations)
      .set(set)
      .where(and(eq(partOperations.id, operationId), eq(partOperations.orgId, orgId)))
      .returning();
    if (!op) throw new NotFoundError("Operation not found");
    return op;
  },

  // ─── 2.3 Materials CRUD ──────────────────────────────────────────────────────

  async listPartMaterials(orgId: string, partId: string): Promise<PartMaterial[]> {
    return db
      .select()
      .from(partMaterials)
      .where(and(eq(partMaterials.orgId, orgId), eq(partMaterials.partId, partId)))
      .orderBy(asc(partMaterials.sortOrder), asc(partMaterials.createdAt));
  },

  async addPartMaterial(
    orgId: string,
    partId: string,
    input: AddMaterialInput,
  ): Promise<PartMaterial> {
    const data = parseOrThrow(addMaterialSchema, input);
    await assertPartInOrg(orgId, partId);
    const sortOrder = data.sortOrder ?? (await nextSortOrder(partMaterials, orgId, partId));
    const [material] = await db
      .insert(partMaterials)
      .values({
        orgId,
        partId,
        materialType: data.materialType,
        fields: data.fields,
        sortOrder,
      })
      .returning();
    if (!material) throw new Error("Failed to add material");
    return material;
  },

  /** Patch a material. `fields` is replaced wholesale (no deep merge). */
  async updatePartMaterial(
    orgId: string,
    materialId: string,
    patch: UpdateMaterialInput,
  ): Promise<PartMaterial> {
    const data = parseOrThrow(updateMaterialSchema, patch);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.materialType !== undefined) set.materialType = data.materialType;
    if (data.fields !== undefined) set.fields = data.fields;
    if (data.unitPriceOverrideCents !== undefined)
      set.unitPriceOverrideCents = data.unitPriceOverrideCents;
    if (data.sortOrder !== undefined) set.sortOrder = data.sortOrder;

    const [material] = await db
      .update(partMaterials)
      .set(set)
      .where(and(eq(partMaterials.id, materialId), eq(partMaterials.orgId, orgId)))
      .returning();
    if (!material) throw new NotFoundError("Material not found");
    return material;
  },

  async deletePartMaterial(orgId: string, materialId: string): Promise<void> {
    const deleted = await db
      .delete(partMaterials)
      .where(and(eq(partMaterials.id, materialId), eq(partMaterials.orgId, orgId)))
      .returning({ id: partMaterials.id });
    if (deleted.length === 0) throw new NotFoundError("Material not found");
  },

  async reorderPartMaterials(orgId: string, partId: string, orderedIds: string[]): Promise<void> {
    const ids = parseOrThrow(reorderSchema, orderedIds);
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: partMaterials.id })
        .from(partMaterials)
        .where(and(eq(partMaterials.orgId, orgId), eq(partMaterials.partId, partId)));
      const existingIds = new Set(existing.map((r) => r.id));
      if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
        throw new ValidationError("orderedIds must be exactly this part's materials");
      }
      for (const [i, id] of ids.entries()) {
        await tx
          .update(partMaterials)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(partMaterials.id, id), eq(partMaterials.orgId, orgId)));
      }
    });
  },

  // ─── 2.4 Notes ───────────────────────────────────────────────────────────────

  /**
   * Update a part's notes. Per field: a string value (including "") is written
   * (so "" clears the note); `null` or omission leaves the field unchanged. This
   * lets prompt 3 debounce per-field saves without clobbering the other field.
   */
  async updatePartNotes(orgId: string, partId: string, patch: NotesInput): Promise<void> {
    const data = parseOrThrow(notesSchema, patch);
    const set: Record<string, unknown> = {};
    if (typeof data.external === "string") set.notesExternal = data.external;
    if (typeof data.internal === "string") set.notesInternal = data.internal;
    if (Object.keys(set).length === 0) return; // nothing to change

    const updated = await db
      .update(parts)
      .set(set)
      .where(and(eq(parts.id, partId), eq(parts.orgId, orgId)))
      .returning({ id: parts.id });
    if (updated.length === 0) throw new NotFoundError("Part not found");
  },

  // ─── 2.5 RFQ-level quote bulk ────────────────────────────────────────────────

  /**
   * Update RFQ-wide quote bulk settings. Per field: a value is written; `null`
   * clears it; omission (undefined) leaves it unchanged. Percentages are
   * validated 0–100 in-service (clearer error than the DB CHECK).
   */
  async updateRfqQuoteBulk(orgId: string, rfqId: string, patch: QuoteBulkInput): Promise<void> {
    const data = parseOrThrow(quoteBulkSchema, patch);
    const set: Record<string, unknown> = {};
    if (data.markupPct !== undefined)
      set.quoteBulkMarkupPct = data.markupPct === null ? null : String(data.markupPct);
    if (data.discountPct !== undefined)
      set.quoteBulkDiscountPct = data.discountPct === null ? null : String(data.discountPct);
    if (data.leadTimeVariants !== undefined) set.quoteLeadTimeVariants = data.leadTimeVariants;
    if (Object.keys(set).length === 0) return; // nothing to change

    set.updatedAt = new Date();
    const updated = await db
      .update(rfqs)
      .set(set)
      .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)))
      .returning({ id: rfqs.id });
    if (updated.length === 0) throw new NotFoundError("RFQ not found");
  },
};
