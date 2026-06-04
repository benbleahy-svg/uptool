import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@uptool/db";
import { quoteService } from "@uptool/services";
import { QuotePdf } from "@/components/quote-pdf";

interface Params {
  params: Promise<{ quoteId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { quoteId } = await params;

  // Find the quote (no strict auth — quoteId is a UUID secret; we rely on it being unguessable)
  const rawQuote = await db.query.quotes.findFirst({
    where: (q, { eq }) => eq(q.id, quoteId),
    with: {
      lineItems: {
        with: { part: true },
        orderBy: (li, { asc }) => [asc(li.sortOrder)],
      },
      rfq: { with: { customer: true, contact: true } },
      createdBy: true,
    },
  });

  if (!rawQuote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load org for name
  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.id, rawQuote.orgId),
  });

  const pdfBuffer = await renderToBuffer(
    QuotePdf({
      quoteNumber: rawQuote.quoteNumber,
      orgName: org?.name ?? "Your Company",
      orgContact: org
        ? {
            phone: org.phone,
            website: org.website,
            vatId: org.vatId,
            address: org.addressJsonb as { street?: string; city?: string; postal?: string; country?: string } | null,
          }
        : undefined,
      customerName: rawQuote.rfq.customer?.name ?? rawQuote.rfq.contact?.email ?? "—",
      contactEmail: rawQuote.rfq.contact?.email ?? "",
      createdAt: rawQuote.createdAt.toISOString(),
      notesForCustomer: rawQuote.notesForCustomer ?? "",
      lineItems: rawQuote.lineItems.map((li) => ({
        partLabel: [li.part?.partNumber, li.part?.revision ? `Rev ${li.part.revision}` : null, li.part?.description]
          .filter(Boolean)
          .join(" ") || "—",
        quantity: li.quantity,
        costPerUnitCents: li.costPerUnitCents,
        markupPct: Number(li.markupPct),
        quotePriceCents:
          li.quoteUnitPriceCents ??
          quoteService.computeQuotePrice(li.costPerUnitCents, Number(li.markupPct)),
        leadTimeWeeks: li.leadTimeWeeks,
        tierLabel: li.tierLabel,
        isNoBid: li.isNoBid,
        notesExternal: li.part?.notesExternal ?? null,
      })),
    }),
  );

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Quote-${rawQuote.quoteNumber}.pdf"`,
    },
  });
}
