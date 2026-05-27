import { db, operationTemplates } from "@uptool/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export interface CreateTemplateInput {
  orgId: string;
  name: string;
  operationType?: "machining" | "expense";
  defaultSetupMinutes?: number;
  defaultRunMinutes?: number;
  defaultHourlyRateCents?: number;
}

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
        defaultSetupMinutes: String(input.defaultSetupMinutes ?? 0),
        defaultRunMinutes: String(input.defaultRunMinutes ?? 0),
        defaultHourlyRateCents: input.defaultHourlyRateCents ?? 0,
      })
      .returning();
    if (!template) throw new Error("Failed to create template");
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
};
