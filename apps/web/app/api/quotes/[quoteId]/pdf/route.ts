import { renderQuoteDocPdf } from "@/lib/quoting/render-quote-pdf";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ quoteId: string }>;
}

// Renders the DIN-5008 quote PDF from PERSISTED rows (quote_line_items + quote +
// rfq + org + quote_template). Same render as the email attachment (one source
// of truth — see render-quote-pdf.ts). No strict auth: quoteId is an unguessable
// UUID secret, like the magic-link tokens.
export async function GET(_req: NextRequest, { params }: Params) {
  const { quoteId } = await params;
  const result = await renderQuoteDocPdf(quoteId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Quote-${result.quoteNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
