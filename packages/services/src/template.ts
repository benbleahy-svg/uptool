import { db, operationTemplates } from "@uptool/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export type OperationTemplateType =
  | "machining"
  | "inspection"
  | "pack-and-ship"
  | "finishing"
  | "expense"
  | "other";

export type CostCategory = "inside" | "outside" | "purchased";

export interface CreateTemplateInput {
  orgId: string;
  name: string;
  operationType?: OperationTemplateType;
  costCategory?: CostCategory;
  defaultSetupMinutes?: number;
  defaultRunMinutes?: number;
  defaultHourlyRateCents?: number;
}

export interface UpdateTemplateInput {
  name?: string;
  operationType?: OperationTemplateType;
  costCategory?: CostCategory;
  defaultSetupMinutes?: number;
  defaultRunMinutes?: number;
  defaultHourlyRateCents?: number;
}

/** Standard DACH operation templates seeded on demand from the Kalkulationsvorlagen
 *  page. name | operationType | costCategory | setup min | run min | €/h cents. */
const DACH_OPERATION_TEMPLATES: ReadonlyArray<{
  name: string;
  operationType: OperationTemplateType;
  costCategory: CostCategory;
  defaultSetupMinutes: number;
  defaultRunMinutes: number;
  defaultHourlyRateCents: number;
}> = [
  { name: "Programming", operationType: "machining", costCategory: "inside", defaultSetupMinutes: 0, defaultRunMinutes: 0, defaultHourlyRateCents: 8000 },
  { name: "CNC Milling", operationType: "machining", costCategory: "inside", defaultSetupMinutes: 120, defaultRunMinutes: 60, defaultHourlyRateCents: 8000 },
  { name: "Turning", operationType: "machining", costCategory: "inside", defaultSetupMinutes: 90, defaultRunMinutes: 45, defaultHourlyRateCents: 8000 },
  { name: "Sheet Metal Laser", operationType: "machining", costCategory: "inside", defaultSetupMinutes: 15, defaultRunMinutes: 0, defaultHourlyRateCents: 8000 },
  { name: "Bending", operationType: "machining", costCategory: "inside", defaultSetupMinutes: 20, defaultRunMinutes: 0, defaultHourlyRateCents: 6000 },
  { name: "QA / Inspection", operationType: "inspection", costCategory: "inside", defaultSetupMinutes: 15, defaultRunMinutes: 3, defaultHourlyRateCents: 6500 },
  { name: "Packaging & Shipping", operationType: "pack-and-ship", costCategory: "inside", defaultSetupMinutes: 20, defaultRunMinutes: 1, defaultHourlyRateCents: 5000 },
  { name: "Surface Treatment", operationType: "finishing", costCategory: "outside", defaultSetupMinutes: 30, defaultRunMinutes: 0, defaultHourlyRateCents: 7000 },
];

export const templateService = {
  async findAll(orgId: string) {
    return db.query.operationTemplates.findMany({
      where: (t, { eq }) => eq(t.orgId, orgId),
      orderBy: [desc(operationTemplates.lastUsedAt), asc(operationTemplates.name)],
    });
  },

  async create(input: CreateTemplateInput) {
    const [template] = await db
      .insert(operationTemplates)
      .values({
        orgId: input.orgId,
        name: input.name,
        operationType: input.operationType ?? "machining",
        costCategory: input.costCategory ?? "inside",
        defaultSetupMinutes: String(input.defaultSetupMinutes ?? 0),
        defaultRunMinutes: String(input.defaultRunMinutes ?? 0),
        defaultHourlyRateCents: input.defaultHourlyRateCents ?? 0,
      })
      .returning();
    if (!template) throw new Error("Failed to create template");
    return template;
  },

  async update(orgId: string, templateId: string, input: UpdateTemplateInput) {
    const [template] = await db
      .update(operationTemplates)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.operationType !== undefined && { operationType: input.operationType }),
        ...(input.costCategory !== undefined && { costCategory: input.costCategory }),
        ...(input.defaultSetupMinutes !== undefined && {
          defaultSetupMinutes: String(input.defaultSetupMinutes),
        }),
        ...(input.defaultRunMinutes !== undefined && {
          defaultRunMinutes: String(input.defaultRunMinutes),
        }),
        ...(input.defaultHourlyRateCents !== undefined && {
          defaultHourlyRateCents: input.defaultHourlyRateCents,
        }),
      })
      .where(and(eq(operationTemplates.id, templateId), eq(operationTemplates.orgId, orgId)))
      .returning();
    if (!template) throw new Error("Template not found");
    return template;
  },

  async delete(orgId: string, templateId: string) {
    await db
      .delete(operationTemplates)
      .where(and(eq(operationTemplates.id, templateId), eq(operationTemplates.orgId, orgId)));
  },

  async recordUsage(orgId: string, templateId: string) {
    await db
      .update(operationTemplates)
      .set({
        usageCount: sql`usage_count + 1`,
        lastUsedAt: new Date(),
      })
      .where(and(eq(operationTemplates.id, templateId), eq(operationTemplates.orgId, orgId)));
  },

  /** Create the standard DACH operation templates for an org, skipping any whose
   *  name already exists (idempotent — operation_templates has no name unique key,
   *  so we filter against existing names rather than relying on ON CONFLICT). */
  async seedDachDefaults(orgId: string) {
    const existing = await db
      .select({ name: operationTemplates.name })
      .from(operationTemplates)
      .where(eq(operationTemplates.orgId, orgId));
    const existingNames = new Set(existing.map((r) => r.name));
    const missing = DACH_OPERATION_TEMPLATES.filter((t) => !existingNames.has(t.name));
    if (missing.length === 0) return [];
    return db
      .insert(operationTemplates)
      .values(
        missing.map((t) => ({
          orgId,
          name: t.name,
          operationType: t.operationType,
          costCategory: t.costCategory,
          defaultSetupMinutes: String(t.defaultSetupMinutes),
          defaultRunMinutes: String(t.defaultRunMinutes),
          defaultHourlyRateCents: t.defaultHourlyRateCents,
        })),
      )
      .returning();
  },
};
