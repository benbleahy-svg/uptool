import type { DocInfo, DocRecipient, DocTemplate } from "@/lib/quoting/quote-doc";
import { resolveRfq } from "@/lib/resolve-rfq";
import { db } from "@uptool/db";
import { type LegalForm, quoteTemplateService, storageService } from "@uptool/services";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { SendView } from "./send-view";
import { type OriginalEmail, STUB_ORIGINAL_EMAIL } from "./send-stub";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

/** Download a stored object as a data URI (inlined into the PDF). */
async function toDataUri(key: string): Promise<string | null> {
  try {
    const { body, contentType } = await storageService.download(key);
    return `data:${contentType};base64,${body.toString("base64")}`;
  } catch {
    return null;
  }
}

// Minimal defaults when the org hasn't configured a quote template yet.
function defaultTemplate(companyName: string): DocTemplate {
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
    introText: "Dear Sir or Madam,\n\nthank you for your enquiry. We are pleased to offer the following:",
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
    logoDataUri: null,
    footerLogoUris: [],
  };
}

// Send stage: the quote document is driven entirely by the saved quote_template;
// recipient/info come from the RFQ. Quote number is the RFQ number for now.
export default async function SendPage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam } = await params;

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const rfq = await resolveRfq(org.id, rfqParam);
  if (!rfq) notFound();

  const row = await quoteTemplateService.get(org.id);

  const template: DocTemplate = row
    ? {
        slogan: row.slogan,
        companyName: row.companyName || org.name,
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
        logoDataUri: row.logoUrl ? await toDataUri(row.logoUrl) : null,
        footerLogoUris: (
          await Promise.all(row.footerLogos.map((k) => toDataUri(k)))
        ).filter((u): u is string => u !== null),
      }
    : defaultTemplate(org.name);

  const recipient: DocRecipient = {
    organization: rfq.customer?.name ?? "—",
    contactName: rfq.contact?.name ?? "",
    street: "",
    postalCode: "",
    city: "",
    country: "",
  };

  const contactName = rfq.contact?.name ?? rfq.contact?.email ?? "—";
  const info: DocInfo = {
    customerNo: "",
    projectNo: String(rfq.rfqNumber),
    orderedBy: contactName,
    quoteNo: String(rfq.rfqNumber),
    dateISO: new Date().toISOString(),
    deliveryDateISO: null,
  };

  // Original email (RFQ thread's last message) for the reply composer.
  const messages = rfq.threads
    .flatMap((t) => t.messages)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  const last = messages.at(-1);
  let original: OriginalEmail = STUB_ORIGINAL_EMAIL;
  if (last) {
    const ourInbox =
      rfq.emailAccount?.email ??
      (last.direction === "outbound" ? last.fromEmail : last.toEmails?.[0]) ??
      "";
    original = {
      replyFromEmail: ourInbox,
      replyFromUnverified: true,
      dateLabel: format(last.receivedAt, "MMM d, h:mm a"),
      bodyText: last.bodyText ?? "",
      attachments: last.attachments.map((a) => a.filename),
    };
  }

  return (
    <SendView
      orgSlug={orgSlug}
      rfqParam={rfqParam}
      rfqId={rfq.id}
      rfqNumber={rfq.rfqNumber}
      template={template}
      recipient={recipient}
      info={info}
      customerEmail={rfq.contact?.email ?? "—"}
      contactName={contactName}
      original={original}
    />
  );
}
