import { requireAuth } from "@/lib/auth";
import type { DocTemplate, QuotePdfRequest } from "@/lib/quoting/quote-doc";
import { QuoteDocument } from "@/app/[orgSlug]/rfqs/[rfqId]/send/quote-document";
import { db } from "@uptool/db";
import { storageService } from "@uptool/services";
import { renderToBuffer } from "@react-pdf/renderer";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Single source of truth for rendering the DIN 5008 quote PDF. The client POSTs
 * the document spec (template fields + logo storage keys, recipient, info,
 * positions); the server resolves the logos and renders via renderToBuffer. Used
 * by the Send-page preview/Download/Print, the settings live preview, and the
 * (later) email attachment. Logos are resolved here so the client never handles
 * image bytes — and node react-pdf needs no cross-origin fetch.
 */
export async function POST(req: NextRequest) {
  const { userId } = await requireAuth();

  let body: QuotePdfRequest;
  try {
    body = (await req.json()) as QuotePdfRequest;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verify the caller is a member of the org whose logos we'll resolve.
  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, body.orgSlug),
  });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });
  const orgId = org.id;
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, orgId), eq(m.userId, userId)),
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Resolve a storage key to a data URI; only keys belonging to this org are
  // honored. Failures degrade to "no image" rather than breaking the render.
  async function resolve(key: string | null): Promise<string | null> {
    if (!key || !key.startsWith(`${orgId}/`)) return null;
    try {
      const { body: bytes, contentType } = await storageService.download(key);
      return `data:${contentType};base64,${bytes.toString("base64")}`;
    } catch {
      return null;
    }
  }

  const { logoKey, footerLogoKeys, ...templateFields } = body.template;
  const template: DocTemplate = {
    ...templateFields,
    logoUrl: await resolve(logoKey),
    footerLogoUrls: (await Promise.all(footerLogoKeys.map(resolve))).filter(
      (u): u is string => u !== null,
    ),
  };

  const pdf = await renderToBuffer(
    QuoteDocument({
      template,
      recipient: body.recipient,
      info: body.info,
      positions: body.positions,
    }),
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${body.info.quoteNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
