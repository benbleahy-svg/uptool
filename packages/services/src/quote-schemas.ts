// Zod input schemas for the quote line-item mutations. Reuses parseOrThrow +
// ValidationError from the estimate epic (no second validation pattern). A quote
// line is a pricing-tier row: (partId, quantity, frozen costPerUnitCents,
// markupPct, leadTimeWeeks, tierLabel). markupPct allows negatives (= discount).

import { z } from "zod";
import { parseOrThrow } from "./estimate/schemas";

const cents = z.number().int().nonnegative();
const qty = z.number().int().positive();
const uuid = z.string().uuid();
const leadTimeWeeks = z.number().int().nonnegative();
const tierLabel = z.string().min(1);

// Markup percent. Negative = discount (no separate discount field). Floored at
// -100% so a line can never produce a negative price; capped at the numeric(6,2)
// column max to avoid a DB overflow error.
const signedPct = z.number().min(-100).max(9999.99);

/** New line item. costPerUnitCents is the frozen estimate-unit snapshot supplied
 *  by the caller (see ADR 0022 / Step 1C); the service never recomputes it. */
export const addQuoteLineItemSchema = z.object({
  partId: uuid,
  quantity: qty,
  costPerUnitCents: cents,
  markupPct: signedPct.optional(), // defaults to 0 in the service
  leadTimeWeeks: leadTimeWeeks.nullable().optional(),
  tierLabel: tierLabel.nullable().optional(),
});
export type AddQuoteLineItemInput = z.infer<typeof addQuoteLineItemSchema>;

/** Partial patch. partId and costPerUnitCents are intentionally absent — the
 *  snapshot cost is frozen and a line can't be re-pointed to another part. */
export const updateQuoteLineItemSchema = z
  .object({
    quantity: qty,
    markupPct: signedPct,
    leadTimeWeeks: leadTimeWeeks.nullable(),
    tierLabel: tierLabel.nullable(),
  })
  .partial();
export type UpdateQuoteLineItemInput = z.infer<typeof updateQuoteLineItemSchema>;

export const quoteReorderSchema = z.array(uuid).min(1);

/** Customer-facing quote note. "" is allowed (clears it). */
export const quoteNotesSchema = z.string();

export { parseOrThrow };
