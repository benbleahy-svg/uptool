// Server-side DIN-5008 quote PDF from PERSISTED rows (quote_line_items + quotes +
// rfq + org + quote_template). Single source of truth for the Send-page preview,
// the Download/Print, and the email attachment — fed entirely from the DB, never
// the client snapshot. Used by GET /api/quotes/[id]/pdf and quoteService's send
// action (via the action, which base64s the bytes). React-PDF lives in apps/web
// (not services), so this helper does too.

import { QuoteDocument } from "@/app/[orgSlug]/rfqs/[rfqId]/send/quote-document";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@uptool/db";
import { type LegalForm, quoteTemplateService, storageService } from "@uptool/services";
import {
  type DocInfo,
  type DocRecipient,
  type DocTemplate,
  type DocTemplateSpec,
  positionsFromLineItems,
} from "./quote-doc";

type TemplateRow = NonNullable<Awaited<ReturnType<typeof quoteTemplateService.get>>>;

/** Minimal DIN spec when the org hasn't configured a quote template yet. */
function defaultTemplateSpec(companyName: string): DocTemplateSpec {
  return {
    slogan: "",
    companyName,
    legalForm: "GmbH" as LegalForm,
    street: "",
    postalCode: "",
    city: "",
    country: "Germany",
    phone: "",
    fax: "",
    email: "",
    website: "",
    senderPlace: "",
    locale: "en-US",
    currency: "EUR",
    vatRate: 19,
    reducedVatRate: 7,
    smallBusiness: false,
    subjectTemplate: "Quote No. {quoteNo}",
    introText:
      "Dear Sir or Madam,\n\nthank you for your enquiry. We are pleased to offer the following:",
    closingText: "Kind regards",
    validityDays: 30,
    deliveryTerms: "ex works",
    paymentTerms: "Net 14 days.",
    termsText: "",
    contacts: [],
    managingDirectors: [],
    registerCourt: "",
    registerNumber: "",
    jurisdiction: "",
    taxNumber: "",
    vatId: "",
    bankAccounts: [],
    logoKey: null,
    footerLogoKeys: [],
  };
}

function templateSpec(row: TemplateRow, orgName: string): DocTemplateSpec {
  return {
    slogan: row.slogan,
    companyName: row.companyName || orgName,
    legalForm: row.legalForm,
    street: row.street,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    phone: row.phone,
    fax: row.fax,
    email: row.email,
    website: row.website,
    senderPlace: row.senderPlace,
    locale: row.locale,
    currency: row.currency,
    vatRate: Number(row.vatRate),
    reducedVatRate: Number(row.reducedVatRate),
    smallBusiness: row.smallBusiness,
    subjectTemplate: row.subjectTemplate,
    introText: row.introText,
    closingText: row.closingText,
    validityDays: row.validityDays,
    deliveryTerms: row.deliveryTerms,
    paymentTerms: row.paymentTerms,
    termsText: row.termsText,
    contacts: row.contacts,
    managingDirectors: row.managingDirectors,
    registerCourt: row.registerCourt,
    registerNumber: row.registerNumber,
    jurisdiction: row.jurisdiction,
    taxNumber: row.taxNumber,
    vatId: row.vatId,
    bankAccounts: row.bankAccounts,
    logoKey: row.logoUrl ?? null,
    footerLogoKeys: row.footerLogos,
  };
}

/** Render the DIN-5008 quote PDF for a quote. Returns null if the quote/org is
 *  missing (caller maps to 404). */
export async function renderQuoteDocPdf(
  quoteId: string,
): Promise<{ buffer: Buffer; quoteNumber: number } | null> {
  const quote = await db.query.quotes.findFirst({
    where: (q, { eq }) => eq(q.id, quoteId),
    with: {
      lineItems: {
        with: { part: true },
        orderBy: (li, { asc }) => [asc(li.sortOrder)],
      },
      rfq: { with: { customer: true, contact: true } },
    },
  });
  if (!quote) return null;

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.id, quote.orgId) });
  if (!org) return null;

  const row = await quoteTemplateService.get(org.id);
  const spec = row ? templateSpec(row, org.name) : defaultTemplateSpec(org.name);

  // Resolve logo storage keys → data URIs (org-scoped; failures degrade to none).
  const resolve = async (key: string | null): Promise<string | null> => {
    if (!key || !key.startsWith(`${org.id}/`)) return null;
    try {
      const { body, contentType } = await storageService.download(key);
      return `data:${contentType};base64,${body.toString("base64")}`;
    } catch {
      return null;
    }
  };
  const { logoKey, footerLogoKeys, ...templateFields } = spec;
  const template: DocTemplate = {
    ...templateFields,
    logoUrl: await resolve(logoKey),
    footerLogoUrls: (await Promise.all(footerLogoKeys.map(resolve))).filter(
      (u): u is string => u !== null,
    ),
  };

  const recipient: DocRecipient = {
    organization: quote.rfq.customer?.name ?? "—",
    contactName: quote.rfq.contact?.name ?? "",
    street: "",
    postalCode: "",
    city: "",
    country: "",
  };

  const info: DocInfo = {
    customerNo: "",
    projectNo: String(quote.rfq.rfqNumber),
    orderedBy: quote.rfq.contact?.name ?? quote.rfq.contact?.email ?? "—",
    quoteNo: String(quote.quoteNumber),
    dateISO: (quote.sentAt ?? quote.createdAt).toISOString(),
    deliveryDateISO: null,
  };

  const positions = positionsFromLineItems(
    quote.lineItems.map((li) => ({
      partId: li.partId,
      partNumber: li.part?.partNumber ?? null,
      revision: li.part?.revision ?? null,
      description: li.part?.description ?? null,
      notesExternal: li.part?.notesExternal ?? null,
      quantity: li.quantity,
      leadTimeWeeks: li.leadTimeWeeks,
      unitPriceCents:
        li.quoteUnitPriceCents ??
        Math.round(li.costPerUnitCents * (1 + Number(li.markupPct) / 100)),
      totalPriceCents: li.quoteTotalCents,
    })),
  );

  const pdf = await renderToBuffer(QuoteDocument({ template, recipient, info, positions }));
  return { buffer: Buffer.from(pdf), quoteNumber: quote.quoteNumber };
}
