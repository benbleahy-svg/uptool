// Org-scoped materials library service. Backs the Settings → Materialien page and
// (later) the calculator's material picker. Pure services module — no Next/React.

import { db, orgMaterials } from "@uptool/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { NotFoundError, ValidationError } from "./estimate/errors";

export const MATERIAL_CATEGORIES = [
  "steel",
  "aluminium",
  "stainless",
  "titanium",
  "plastic",
  "copper",
  "other",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

const createSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  category: z.enum(MATERIAL_CATEGORIES),
  densityGCm3: z.number().positive("Density must be positive"),
  priceEurPerKg: z.number().min(0).default(0),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.enum(MATERIAL_CATEGORIES).optional(),
  densityGCm3: z.number().positive().optional(),
  priceEurPerKg: z.number().min(0).optional(),
});

export type CreateOrgMaterialInput = z.input<typeof createSchema>;
export type UpdateOrgMaterialInput = z.input<typeof updateSchema>;

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new ValidationError("Invalid material input", result.error.issues);
  return result.data;
}

export const orgMaterialService = {
  async findAll(orgId: string) {
    return db.query.orgMaterials.findMany({
      where: (m, { eq: e }) => e(m.orgId, orgId),
      orderBy: [asc(orgMaterials.category), asc(orgMaterials.name)],
    });
  },

  async create(input: CreateOrgMaterialInput) {
    const data = parseOrThrow(createSchema, input);
    const [row] = await db
      .insert(orgMaterials)
      .values({
        orgId: data.orgId,
        name: data.name,
        category: data.category,
        densityGCm3: String(data.densityGCm3),
        priceEurPerKg: String(data.priceEurPerKg ?? 0),
      })
      .returning();
    if (!row) throw new Error("Failed to create material");
    return row;
  },

  async update(orgId: string, materialId: string, input: UpdateOrgMaterialInput) {
    const data = parseOrThrow(updateSchema, input);
    // Editing the price stamps price_updated_at so the staleness badge resets.
    const priceChanged = data.priceEurPerKg !== undefined;
    const [row] = await db
      .update(orgMaterials)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.densityGCm3 !== undefined && { densityGCm3: String(data.densityGCm3) }),
        ...(priceChanged && {
          priceEurPerKg: String(data.priceEurPerKg),
          priceUpdatedAt: new Date(),
        }),
        updatedAt: new Date(),
      })
      .where(and(eq(orgMaterials.id, materialId), eq(orgMaterials.orgId, orgId)))
      .returning();
    if (!row) throw new NotFoundError("Material not found");
    return row;
  },

  /** Stamp price_updated_at = now() without changing the price (the "Mark price
   *  updated" action — confirms the current price is still valid). */
  async markPriceUpdated(orgId: string, materialId: string) {
    const [row] = await db
      .update(orgMaterials)
      .set({ priceUpdatedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orgMaterials.id, materialId), eq(orgMaterials.orgId, orgId)))
      .returning();
    if (!row) throw new NotFoundError("Material not found");
    return row;
  },

  /** Delete a material. Default (seeded) materials are protected — they can be
   *  edited but not removed. */
  async delete(orgId: string, materialId: string) {
    const material = await db.query.orgMaterials.findFirst({
      where: (m, { and: a, eq: e }) => a(e(m.id, materialId), e(m.orgId, orgId)),
      columns: { id: true, isDefault: true },
    });
    if (!material) throw new NotFoundError("Material not found");
    if (material.isDefault) {
      throw new ValidationError("Default materials cannot be deleted");
    }
    await db
      .delete(orgMaterials)
      .where(and(eq(orgMaterials.id, materialId), eq(orgMaterials.orgId, orgId)));
  },
};
