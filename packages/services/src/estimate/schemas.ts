// Zod input schemas for the estimate services. Every write path validates with
// these and throws ValidationError on failure — callers are never trusted.

import { z } from "zod";
import { ValidationError } from "./errors";

const cents = z.number().int().nonnegative();
const minutes = z.number().nonnegative(); // may be fractional (e.g. 0.9 min)
const pct = z.number().min(0).max(100);
const uuid = z.string().uuid();

/** Volume-discount tier (stored in part_operations.volume_discount_tiers jsonb). */
export const volumeDiscountTierSchema = z.object({
  minQty: z.number().int().nonnegative(),
  discountPct: pct,
});
export type VolumeDiscountTierInput = z.infer<typeof volumeDiscountTierSchema>;

/** RFQ-level lead-time variant (stored in rfqs.quote_lead_time_variants jsonb).
 *  Provisional shape — the quote UI may refine it in a later prompt. */
export const leadTimeVariantSchema = z.object({
  label: z.string().min(1),
  leadTimeWeeks: z.number().int().nonnegative(),
});
export type LeadTimeVariant = z.infer<typeof leadTimeVariantSchema>;

export const costCategorySchema = z.enum(["inside", "outside", "purchased"]);
export const timeSourceSchema = z.enum(["manual", "formula", "template"]);

export const addOperationSchema = z.object({
  name: z.string().min(1),
  operationType: z.string().min(1).optional(),
  costCategory: costCategorySchema.optional(),
  timeSource: timeSourceSchema.optional(),
  setupMinutes: minutes.optional(),
  runMinutes: minutes.optional(),
  hourlyRateCents: cents.optional(),
  isNonRecurring: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type AddOperationInput = z.infer<typeof addOperationSchema>;

/** Partial patch; only provided keys are written. Nullable override columns accept
 *  a value to set; clearing them is done via clearPartOperationOverride. */
export const updateOperationSchema = z
  .object({
    name: z.string().min(1),
    costCategory: costCategorySchema,
    timeSource: timeSourceSchema,
    setupMinutes: minutes,
    runMinutes: minutes,
    isNonRecurring: z.boolean(),
    unitPriceOverrideCents: cents.nullable(),
    markupPct: pct.nullable(),
    setupRateCents: cents.nullable(),
    runtimeRateCents: cents.nullable(),
    volumeDiscountTiers: z.array(volumeDiscountTierSchema).nullable(),
  })
  .partial();
export type UpdateOperationInput = z.infer<typeof updateOperationSchema>;

export const addMaterialSchema = z.object({
  materialType: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type AddMaterialInput = z.infer<typeof addMaterialSchema>;

export const updateMaterialSchema = z
  .object({
    materialType: z.string().min(1),
    fields: z.record(z.string(), z.unknown()),
    unitPriceOverrideCents: cents.nullable(),
    sortOrder: z.number().int().nonnegative(),
  })
  .partial();
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

/** Notes patch. A string value (incl. "") is written; null/undefined leaves the
 *  field unchanged. */
export const notesSchema = z.object({
  external: z.string().nullable().optional(),
  internal: z.string().nullable().optional(),
});
export type NotesInput = z.infer<typeof notesSchema>;

/** Quote bulk patch. A value is written; null clears; undefined leaves unchanged. */
export const quoteBulkSchema = z.object({
  markupPct: pct.nullable().optional(),
  discountPct: pct.nullable().optional(),
  leadTimeVariants: z.array(leadTimeVariantSchema).nullable().optional(),
});
export type QuoteBulkInput = z.infer<typeof quoteBulkSchema>;

export const reorderSchema = z.array(uuid).min(1);

export const overrideFieldSchema = z.enum([
  "unitPriceOverride",
  "markup",
  "setupRate",
  "runtimeRate",
  "volumeDiscount",
]);
export type OverrideField = z.infer<typeof overrideFieldSchema>;

/** Validate `input` against `schema`, throwing ValidationError (not ZodError) so
 *  the service layer surfaces a single typed error. */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid input", result.error.issues);
  }
  return result.data;
}
