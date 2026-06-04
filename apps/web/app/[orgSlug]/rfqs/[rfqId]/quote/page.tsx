import { resolveRfq } from "@/lib/resolve-rfq";
import { db } from "@uptool/db";
import { DEFAULT_QUANTITY_BREAKS, partService, quoteService } from "@uptool/services";
import { QuoteView } from "./quote-view";
import { type QuoteLine, type QuotePartMeta, rowToLine } from "./quote-state";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

// The Quote stage is reached from the RFQ sidebar once every part is finalised
// (Complete or No Bid). Tier rows + notes are persisted (quote_line_items /
// quotes.notes_for_customer); an RFQ with no quote work yet shows an empty
// builder and burns no quote number until the first tier is added.
export default async function QuotePage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam } = await params;

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  const rfq = org ? await resolveRfq(org.id, rfqParam) : undefined;

  const customer = rfq?.customer
    ? {
        contact: rfq.contact?.name ?? rfq.contact?.email ?? "—",
        organization: rfq.customer.name,
      }
    : undefined;

  let parts: QuotePartMeta[] = [];
  let initialLines: QuoteLine[] = [];
  let initialQuoteNote = "";

  if (org && rfq) {
    const quantityBreaks = rfq.quantityBreaks?.length
      ? rfq.quantityBreaks
      : DEFAULT_QUANTITY_BREAKS;

    const [partRows, lineRows, draft] = await Promise.all([
      partService.findByRfq(org.id, rfq.id),
      quoteService.listQuoteLineItems(org.id, rfq.id),
      db.query.quotes.findFirst({
        where: (q, { and, eq }) =>
          and(eq(q.orgId, org.id), eq(q.rfqId, rfq.id), eq(q.status, "draft")),
        columns: { notesForCustomer: true },
      }),
    ]);

    parts = partRows.map((p) => ({
      partId: p.id,
      partNumber: p.partNumber ?? "—",
      revision: p.revision ?? "",
      description: p.description ?? "",
      noBid: p.isNoBid,
      note: p.notesExternal ?? "",
      estimateByQty: partService.computeCostsForPart(p, p.operations, quantityBreaks),
    }));

    initialLines = lineRows.map(rowToLine);
    initialQuoteNote = draft?.notesForCustomer ?? "";
  }

  return (
    <QuoteView
      customer={customer}
      orgSlug={orgSlug}
      rfqParam={rfqParam}
      rfqId={rfq?.id ?? rfqParam}
      rfqNumber={rfq?.rfqNumber ?? (Number.parseInt(rfqParam, 10) || 0)}
      parts={parts}
      initialLines={initialLines}
      initialQuoteNote={initialQuoteNote}
    />
  );
}
