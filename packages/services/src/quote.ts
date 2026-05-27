import {
  db,
  orgs,
  quoteLineItems,
  quotes,
  rfqs,
  withOrgContext,
} from "@uptool/db";
import { and, eq, sql } from "drizzle-orm";
import { partService, DEFAULT_QUANTITY_BREAKS } from "./part";

export interface CreateQuoteInput {
  orgId: string;
  rfqId: string;
  userId: string;
  notesForCustomer?: string;
  lineItems: Array<{
    partId: string;
    quantity: number;
    costPerUnitCents: number;
    markupPct: number;
    leadTimeWeeks?: number;
    isNoBid?: boolean;
  }>;
}

export interface SendQuoteInput {
  orgId: string;
  quoteId: string;
  toEmails: string[];
  subject: string;
  bodyText: string;
  pdfBase64: string;
}

export const quoteService = {
  async findByRfq(orgId: string, rfqId: string) {
    return db.query.quotes.findMany({
      where: (q, { and, eq }) => and(eq(q.orgId, orgId), eq(q.rfqId, rfqId)),
      with: {
        lineItems: {
          with: { part: true },
          orderBy: (li, { asc }) => [asc(li.createdAt)],
        },
      },
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });
  },

  async findById(orgId: string, quoteId: string) {
    return db.query.quotes.findFirst({
      where: (q, { and, eq }) => and(eq(q.orgId, orgId), eq(q.id, quoteId)),
      with: {
        lineItems: {
          with: { part: { with: { operations: true } } },
          orderBy: (li, { asc }) => [asc(li.createdAt)],
        },
        rfq: { with: { customer: true, contact: true } },
        createdBy: true,
      },
    });
  },

  async createOrUpdate(input: CreateQuoteInput) {
    return withOrgContext(input.orgId, async (tx) => {
      // Check for existing draft
      const existing = await tx.query.quotes.findFirst({
        where: (q, { and, eq }) =>
          and(eq(q.orgId, input.orgId), eq(q.rfqId, input.rfqId), eq(q.status, "draft")),
      });

      let quoteId: string;

      if (existing) {
        quoteId = existing.id;
        await tx
          .update(quotes)
          .set({ notesForCustomer: input.notesForCustomer })
          .where(eq(quotes.id, quoteId));
        // Remove old line items to replace
        await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
      } else {
        // Increment quote counter
        const [updated] = await tx
          .update(orgs)
          .set({ quoteCounter: sql`quote_counter + 1` })
          .where(eq(orgs.id, input.orgId))
          .returning({ quoteCounter: orgs.quoteCounter });

        const quoteNumber = updated?.quoteCounter;
        if (!quoteNumber) throw new Error("Failed to increment quote counter");

        const [quote] = await tx
          .insert(quotes)
          .values({
            orgId: input.orgId,
            rfqId: input.rfqId,
            quoteNumber,
            notesForCustomer: input.notesForCustomer,
            createdByUserId: input.userId,
          })
          .returning();

        if (!quote) throw new Error("Failed to create quote");
        quoteId = quote.id;
      }

      // Insert line items
      if (input.lineItems.length > 0) {
        await tx.insert(quoteLineItems).values(
          input.lineItems.map((li) => ({
            orgId: input.orgId,
            quoteId,
            partId: li.partId,
            quantity: li.quantity,
            costPerUnitCents: li.costPerUnitCents,
            markupPct: String(li.markupPct),
            leadTimeWeeks: li.leadTimeWeeks,
            isNoBid: li.isNoBid ?? false,
          })),
        );
      }

      // Update RFQ status to 'quoted'
      await tx
        .update(rfqs)
        .set({ status: "quoted", updatedAt: new Date() })
        .where(and(eq(rfqs.id, input.rfqId), eq(rfqs.orgId, input.orgId)));

      return quoteId;
    });
  },

  async markSent(orgId: string, quoteId: string) {
    await db
      .update(quotes)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(quotes.id, quoteId), eq(quotes.orgId, orgId)));

    // Also update RFQ status
    const quote = await db.query.quotes.findFirst({
      where: (q, { and, eq }) => and(eq(q.id, quoteId), eq(q.orgId, orgId)),
    });
    if (quote) {
      await db
        .update(rfqs)
        .set({ status: "sent", updatedAt: new Date() })
        .where(and(eq(rfqs.id, quote.rfqId), eq(rfqs.orgId, orgId)));
    }
  },

  async buildLineItemsFromParts(orgId: string, rfqId: string) {
    const partsWithOps = await partService.findByRfq(orgId, rfqId);
    const lineItems: CreateQuoteInput["lineItems"] = [];

    for (const part of partsWithOps) {
      const costs = partService.computeCostsForPart(part, part.operations, DEFAULT_QUANTITY_BREAKS);
      for (const { quantity, costPerUnitCents } of costs) {
        lineItems.push({
          partId: part.id,
          quantity,
          costPerUnitCents,
          markupPct: 30,
        });
      }
    }

    return lineItems;
  },

  computeQuotePrice(costPerUnitCents: number, markupPct: number): number {
    return Math.round(costPerUnitCents * (1 + markupPct / 100));
  },
};
