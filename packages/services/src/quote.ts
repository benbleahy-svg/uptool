import {
  db,
  orgs,
  quoteLineItems,
  quotes,
  rfqs,
  withOrgContext,
} from "@uptool/db";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "./estimate/errors";
import { getSendAdapter } from "./email-sender";
import { partService, DEFAULT_QUANTITY_BREAKS } from "./part";
import { QuoteNoSendAccountError, resolveSendAccount } from "./send-account-resolver";
import {
  type AddQuoteLineItemInput,
  type UpdateQuoteLineItemInput,
  addQuoteLineItemSchema,
  parseOrThrow,
  quoteNotesSchema,
  quoteReorderSchema,
  updateQuoteLineItemSchema,
} from "./quote-schemas";

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

// withOrgContext hands the callback a tx typed as the db client (see
// with-org-context.ts), so helpers take `typeof db`.
type Tx = typeof db;

/** Quote unit price (cents) = round(snapshot cost × (1 + markup/100)). markup may
 *  be negative (discount). The ONLY rounding baked into storage — the whole-€
 *  "Round Quote Unit Price" toggle is a display-time transform (not persisted). */
function roundQuoteUnitCents(costPerUnitCents: number, markupPct: number): number {
  return Math.round(costPerUnitCents * (1 + markupPct / 100));
}

/** The single money helper: quote unit + line total from the frozen snapshot cost,
 *  the line's own markup, and quantity. Op-level markup is already baked into
 *  costPerUnitCents — only markupPct is applied here (no double-count). */
function linePricing(costPerUnitCents: number, markupPct: number, quantity: number) {
  const quoteUnitPriceCents = roundQuoteUnitCents(costPerUnitCents, markupPct);
  return { quoteUnitPriceCents, quoteTotalCents: quoteUnitPriceCents * quantity };
}

/** Throws NotFoundError unless the part exists for this org AND belongs to this
 *  RFQ (a line item can only reference a part of the RFQ being quoted; also the
 *  cross-org guard). */
async function assertPartInRfq(tx: Tx, orgId: string, rfqId: string, partId: string): Promise<void> {
  const part = await tx.query.parts.findFirst({
    where: (p, { and: a, eq: e }) => a(e(p.id, partId), e(p.orgId, orgId), e(p.rfqId, rfqId)),
    columns: { id: true },
  });
  if (!part) throw new NotFoundError("Part not found for this RFQ");
}

/** The single draft quote for an RFQ; created lazily (one-draft-per-RFQ, mirroring
 *  createOrUpdate) with a fresh quoteNumber from orgs.quote_counter. Validates the
 *  RFQ belongs to the org before creating. Does NOT change rfqs.status. */
async function ensureCurrentQuote(
  tx: Tx,
  orgId: string,
  rfqId: string,
  userId?: string,
): Promise<string> {
  // The RFQ's working quote: an open draft if one exists; otherwise the latest
  // existing quote (e.g. an already-sent one — editable in place, with a warning
  // banner; re-send keeps its number). Only create a fresh draft when the RFQ has
  // no quote at all. createQuoteRevision is the explicit "new number" fork.
  const draft = await tx.query.quotes.findFirst({
    where: (q, { and: a, eq: e }) =>
      a(e(q.orgId, orgId), e(q.rfqId, rfqId), e(q.status, "draft")),
    columns: { id: true },
  });
  if (draft) return draft.id;

  const latest = await tx.query.quotes.findFirst({
    where: (q, { and: a, eq: e }) => a(e(q.orgId, orgId), e(q.rfqId, rfqId)),
    orderBy: (q, { desc }) => [desc(q.createdAt)],
    columns: { id: true },
  });
  if (latest) return latest.id;

  const rfq = await tx.query.rfqs.findFirst({
    where: (r, { and: a, eq: e }) => a(e(r.id, rfqId), e(r.orgId, orgId)),
    columns: { id: true },
  });
  if (!rfq) throw new NotFoundError("RFQ not found");

  const [updated] = await tx
    .update(orgs)
    .set({ quoteCounter: sql`quote_counter + 1` })
    .where(eq(orgs.id, orgId))
    .returning({ quoteCounter: orgs.quoteCounter });
  const quoteNumber = updated?.quoteCounter;
  if (!quoteNumber) throw new NotFoundError("Org not found");

  const [quote] = await tx
    .insert(quotes)
    .values({ orgId, rfqId, quoteNumber, createdByUserId: userId ?? null })
    .returning({ id: quotes.id });
  if (!quote) throw new Error("Failed to create quote");
  return quote.id;
}

/** Next append position for a quote's line items. */
async function nextLineItemSortOrder(tx: Tx, orgId: string, quoteId: string): Promise<number> {
  const [row] = await tx
    .select({ max: sql<number | null>`max(${quoteLineItems.sortOrder})` })
    .from(quoteLineItems)
    .where(and(eq(quoteLineItems.orgId, orgId), eq(quoteLineItems.quoteId, quoteId)));
  return Number(row?.max ?? -1) + 1;
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

  /**
   * Send the RFQ's current quote: email the PDF from a resolved connected account
   * (see resolveSendAccount), threading onto the RFQ's email thread when one
   * exists. The PDF bytes are rendered by the caller (apps/web — React-PDF can't
   * run in services) and passed as base64. Order matters: send FIRST, then
   * persist. If the send fails, nothing in the DB changed (caller may retry). If
   * the DB write fails AFTER a successful send, log the inconsistency rather than
   * throw (the email is already out; throwing would mislead the caller into
   * re-sending). Throws QuoteNoSendAccountError if no account can send.
   * Handles first-send AND re-send (idempotent: status→sent, sentAt→now()).
   */
  async sendQuote(
    orgId: string,
    rfqId: string,
    input: { to: string; subject: string; body: string; pdfBase64: string; userId?: string },
  ): Promise<void> {
    // The same quote the send page shows + whose PDF the caller attached.
    const quote = await this.getCurrentQuote(orgId, rfqId);
    if (!quote) throw new NotFoundError("No quote to send");

    const account = await resolveSendAccount(orgId, rfqId, input.userId);
    if (!account) throw new QuoteNoSendAccountError();

    // Thread context: reply onto the RFQ's existing email thread when present;
    // a manual RFQ (no thread) is sent as a fresh email.
    const thread = await db.query.emailThreads.findFirst({
      where: (t, { and, eq: e }) => and(e(t.rfqId, rfqId), e(t.orgId, orgId)),
    });
    let threadId: string | undefined;
    let replyToMessageId: string | undefined;
    if (thread) {
      threadId = thread.providerThreadId;
      const lastInbound = await db.query.emailMessages.findFirst({
        where: (m, { and, eq: e }) => and(e(m.threadId, thread.id), e(m.direction, "inbound")),
        orderBy: (m, { desc }) => [desc(m.receivedAt)],
        columns: { providerMessageId: true },
      });
      replyToMessageId = lastInbound?.providerMessageId ?? undefined;
    }

    // Send FIRST; persist only on success. A throw here leaves the DB unchanged.
    await getSendAdapter(account).sendQuoteEmail({
      account,
      to: input.to,
      subject: input.subject,
      bodyText: input.body,
      pdfBase64: input.pdfBase64,
      pdfFilename: `Quote-${quote.quoteNumber}.pdf`,
      replyToMessageId,
      threadId,
    });

    try {
      await withOrgContext(orgId, async (tx) => {
        await tx
          .update(quotes)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(quotes.id, quote.id));
        await tx
          .update(rfqs)
          .set({ status: "sent", updatedAt: new Date() })
          .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));
      });
    } catch (err) {
      console.error(
        `[quoteService.sendQuote] email sent for quote ${quote.id} but status update failed`,
        err,
      );
    }
  },

  /**
   * Start a revision: a NEW draft quote (fresh number) seeded with the latest
   * sent quote's line items + notes; the RFQ drops to 'quoted' until the revision
   * is sent. Returns the new draft. Throws if there's no sent quote to revise.
   */
  async createQuoteRevision(orgId: string, rfqId: string, userId?: string) {
    return withOrgContext(orgId, async (tx) => {
      const source = await tx.query.quotes.findFirst({
        where: (q, { and: a, eq: e }) =>
          a(e(q.orgId, orgId), e(q.rfqId, rfqId), e(q.status, "sent")),
        orderBy: (q, { desc }) => [desc(q.createdAt)],
        with: { lineItems: { orderBy: (li, { asc }) => [asc(li.sortOrder)] } },
      });
      if (!source) throw new NotFoundError("No sent quote to revise");

      const [updated] = await tx
        .update(orgs)
        .set({ quoteCounter: sql`quote_counter + 1` })
        .where(eq(orgs.id, orgId))
        .returning({ quoteCounter: orgs.quoteCounter });
      const quoteNumber = updated?.quoteCounter;
      if (!quoteNumber) throw new NotFoundError("Org not found");

      const [draft] = await tx
        .insert(quotes)
        .values({
          orgId,
          rfqId,
          quoteNumber,
          createdByUserId: userId ?? null,
          notesForCustomer: source.notesForCustomer,
        })
        .returning();
      if (!draft) throw new Error("Failed to create revision");

      if (source.lineItems.length > 0) {
        await tx.insert(quoteLineItems).values(
          source.lineItems.map((li) => ({
            orgId,
            quoteId: draft.id,
            partId: li.partId,
            quantity: li.quantity,
            costPerUnitCents: li.costPerUnitCents,
            markupPct: li.markupPct,
            quoteUnitPriceCents: li.quoteUnitPriceCents,
            quoteTotalCents: li.quoteTotalCents,
            leadTimeWeeks: li.leadTimeWeeks,
            tierLabel: li.tierLabel,
            sortOrder: li.sortOrder,
            isNoBid: li.isNoBid,
          })),
        );
      }

      await tx
        .update(rfqs)
        .set({ status: "quoted", updatedAt: new Date() })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));

      return draft;
    });
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
    return roundQuoteUnitCents(costPerUnitCents, markupPct);
  },

  /** Centralised money: quote unit price + line total (cents). */
  computeLinePricing(costPerUnitCents: number, markupPct: number, quantity: number) {
    return linePricing(costPerUnitCents, markupPct, quantity);
  },

  // ─── Line-item tier mutations (operate on the single draft quote per RFQ) ─────

  /** The CURRENT quote's line items, ordered by sortOrder (draft if one exists,
   *  else the latest quote — so an already-sent quote stays visible/editable).
   *  Empty if the RFQ has no quote. */
  async listQuoteLineItems(orgId: string, rfqId: string) {
    const current = await this.getCurrentQuote(orgId, rfqId);
    if (!current) return [];
    return db
      .select()
      .from(quoteLineItems)
      .where(and(eq(quoteLineItems.orgId, orgId), eq(quoteLineItems.quoteId, current.id)))
      .orderBy(asc(quoteLineItems.sortOrder), asc(quoteLineItems.createdAt));
  },

  /** The RFQ's current quote (draft preferred, else latest) + whether any sent
   *  quote exists (drives the "already sent" banner + the Re-send/Revision UI).
   *  Null if the RFQ has no quote. */
  async getCurrentQuote(orgId: string, rfqId: string) {
    const all = await db.query.quotes.findMany({
      where: (q, { and: a, eq: e }) => a(e(q.orgId, orgId), e(q.rfqId, rfqId)),
      orderBy: (q, { desc }) => [desc(q.createdAt)],
      columns: { id: true, quoteNumber: true, status: true, sentAt: true, notesForCustomer: true },
    });
    if (all.length === 0) return null;
    const current = all.find((q) => q.status === "draft") ?? all[0];
    if (!current) return null;
    return { ...current, hasSentQuote: all.some((q) => q.status === "sent") };
  },

  /** Append a tier row. costPerUnitCents is the frozen snapshot (caller-supplied);
   *  quote unit/total are computed on write. Lazy-creates the draft quote. */
  async addQuoteLineItem(
    orgId: string,
    rfqId: string,
    input: AddQuoteLineItemInput,
    userId?: string,
  ) {
    const data = parseOrThrow(addQuoteLineItemSchema, input);
    return withOrgContext(orgId, async (tx) => {
      await assertPartInRfq(tx, orgId, rfqId, data.partId);
      const quoteId = await ensureCurrentQuote(tx, orgId, rfqId, userId);
      const sortOrder = await nextLineItemSortOrder(tx, orgId, quoteId);
      const markupPct = data.markupPct ?? 0;
      const { quoteUnitPriceCents, quoteTotalCents } = linePricing(
        data.costPerUnitCents,
        markupPct,
        data.quantity,
      );
      const [row] = await tx
        .insert(quoteLineItems)
        .values({
          orgId,
          quoteId,
          partId: data.partId,
          quantity: data.quantity,
          costPerUnitCents: data.costPerUnitCents,
          markupPct: String(markupPct),
          quoteUnitPriceCents,
          quoteTotalCents,
          leadTimeWeeks: data.leadTimeWeeks ?? null,
          tierLabel: data.tierLabel ?? null,
          sortOrder,
        })
        .returning();
      if (!row) throw new Error("Failed to add line item");
      return row;
    });
  },

  /** Clone a row for the same part (frozen cost + qty kept), inserted immediately
   *  after the source; markup resets to 0 and lead time / tier label clear. */
  async duplicateQuoteLineItem(orgId: string, lineItemId: string) {
    return withOrgContext(orgId, async (tx) => {
      const src = await tx.query.quoteLineItems.findFirst({
        where: (li, { and: a, eq: e }) => a(e(li.id, lineItemId), e(li.orgId, orgId)),
      });
      if (!src) throw new NotFoundError("Line item not found");

      // Make room: shift everything after the source down by one.
      await tx
        .update(quoteLineItems)
        .set({ sortOrder: sql`${quoteLineItems.sortOrder} + 1` })
        .where(
          and(
            eq(quoteLineItems.orgId, orgId),
            eq(quoteLineItems.quoteId, src.quoteId),
            gt(quoteLineItems.sortOrder, src.sortOrder),
          ),
        );

      const { quoteUnitPriceCents, quoteTotalCents } = linePricing(
        src.costPerUnitCents,
        0,
        src.quantity,
      );
      const [row] = await tx
        .insert(quoteLineItems)
        .values({
          orgId,
          quoteId: src.quoteId,
          partId: src.partId,
          quantity: src.quantity,
          costPerUnitCents: src.costPerUnitCents,
          markupPct: "0",
          quoteUnitPriceCents,
          quoteTotalCents,
          leadTimeWeeks: null,
          tierLabel: null,
          sortOrder: src.sortOrder + 1,
        })
        .returning();
      if (!row) throw new Error("Failed to duplicate line item");
      return row;
    });
  },

  /** Patch a line item. Recomputes quote unit/total whenever quantity or markup
   *  changes. The snapshot cost is frozen — never patched. */
  async updateQuoteLineItem(orgId: string, lineItemId: string, patch: UpdateQuoteLineItemInput) {
    const data = parseOrThrow(updateQuoteLineItemSchema, patch);
    return withOrgContext(orgId, async (tx) => {
      const cur = await tx.query.quoteLineItems.findFirst({
        where: (li, { and: a, eq: e }) => a(e(li.id, lineItemId), e(li.orgId, orgId)),
      });
      if (!cur) throw new NotFoundError("Line item not found");

      const set: Record<string, unknown> = {};
      if (data.quantity !== undefined) set.quantity = data.quantity;
      if (data.markupPct !== undefined) set.markupPct = String(data.markupPct);
      if (data.leadTimeWeeks !== undefined) set.leadTimeWeeks = data.leadTimeWeeks;
      if (data.tierLabel !== undefined) set.tierLabel = data.tierLabel;

      if (data.quantity !== undefined || data.markupPct !== undefined) {
        const quantity = data.quantity ?? cur.quantity;
        const markupPct = data.markupPct ?? Number(cur.markupPct);
        const p = linePricing(cur.costPerUnitCents, markupPct, quantity);
        set.quoteUnitPriceCents = p.quoteUnitPriceCents;
        set.quoteTotalCents = p.quoteTotalCents;
      }

      if (Object.keys(set).length === 0) return cur;
      const [row] = await tx
        .update(quoteLineItems)
        .set(set)
        .where(and(eq(quoteLineItems.id, lineItemId), eq(quoteLineItems.orgId, orgId)))
        .returning();
      if (!row) throw new NotFoundError("Line item not found");
      return row;
    });
  },

  async deleteQuoteLineItem(orgId: string, lineItemId: string): Promise<void> {
    const deleted = await db
      .delete(quoteLineItems)
      .where(and(eq(quoteLineItems.id, lineItemId), eq(quoteLineItems.orgId, orgId)))
      .returning({ id: quoteLineItems.id });
    if (deleted.length === 0) throw new NotFoundError("Line item not found");
  },

  /** Re-sort the draft quote's line items. orderedIds must be exactly that quote's
   *  line items (rejects foreign / cross-org ids). */
  async reorderQuoteLineItems(orgId: string, rfqId: string, orderedIds: string[]): Promise<void> {
    const ids = parseOrThrow(quoteReorderSchema, orderedIds);
    await withOrgContext(orgId, async (tx) => {
      const draft = await tx.query.quotes.findFirst({
        where: (q, { and: a, eq: e }) =>
          a(e(q.orgId, orgId), e(q.rfqId, rfqId), e(q.status, "draft")),
        columns: { id: true },
      });
      if (!draft) throw new NotFoundError("No draft quote for this RFQ");

      const existing = await tx
        .select({ id: quoteLineItems.id })
        .from(quoteLineItems)
        .where(and(eq(quoteLineItems.orgId, orgId), eq(quoteLineItems.quoteId, draft.id)));
      const existingIds = new Set(existing.map((r) => r.id));
      if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
        throw new ValidationError("orderedIds must be exactly this quote's line items");
      }
      for (const [i, id] of ids.entries()) {
        await tx
          .update(quoteLineItems)
          .set({ sortOrder: i })
          .where(and(eq(quoteLineItems.id, id), eq(quoteLineItems.orgId, orgId)));
      }
    });
  },

  /** Set the draft quote's customer-facing note ("" clears it). Lazy-creates the
   *  draft quote. Does not change rfqs.status. */
  async updateQuoteNotes(
    orgId: string,
    rfqId: string,
    notesForCustomer: string,
    userId?: string,
  ): Promise<void> {
    const notes = parseOrThrow(quoteNotesSchema, notesForCustomer);
    await withOrgContext(orgId, async (tx) => {
      const quoteId = await ensureCurrentQuote(tx, orgId, rfqId, userId);
      await tx.update(quotes).set({ notesForCustomer: notes }).where(eq(quotes.id, quoteId));
    });
  },
};
