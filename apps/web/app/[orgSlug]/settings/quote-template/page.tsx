import { requireAuth } from "@/lib/auth";
import { db } from "@uptool/db";
import {
  type LegalForm,
  type QuoteTemplateInput,
  quoteTemplateService,
  storageService,
} from "@uptool/services";
import { notFound } from "next/navigation";
import {
  removeFooterLogo,
  removeTemplateLogo,
  saveQuoteTemplate,
  uploadFooterLogo,
  uploadTemplateLogo,
} from "./actions";
import { QuoteTemplateForm } from "./quote-template-form";
import { getTemplateStrings } from "./strings";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function QuoteTemplatePage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const row = await quoteTemplateService.get(org.id);

  // English UI for now; the de stub keeps localization a data-only change.
  const s = getTemplateStrings("en");
  const d = s.defaults;

  // Stored values win; empty text fields fall back to sensible English defaults.
  const initial: QuoteTemplateInput = {
    slogan: row?.slogan ?? "",
    companyName: row?.companyName || org.name || "",
    legalForm: (row?.legalForm ?? "GmbH") as LegalForm,
    street: row?.street ?? "",
    postalCode: row?.postalCode ?? "",
    city: row?.city ?? "",
    country: row?.country || "Germany",
    phone: row?.phone ?? "",
    fax: row?.fax ?? "",
    email: row?.email ?? "",
    website: row?.website ?? "",
    senderPlace: row?.senderPlace ?? "",
    locale: row?.locale || "en-US",
    currency: row?.currency || "EUR",
    vatRate: row ? Number(row.vatRate) : 19,
    reducedVatRate: row ? Number(row.reducedVatRate) : 7,
    smallBusiness: row?.smallBusiness ?? false,
    subjectTemplate: row?.subjectTemplate || d.subjectTemplate,
    introText: row?.introText || d.introText,
    closingText: row?.closingText || d.closingText,
    validityDays: row?.validityDays ?? 30,
    deliveryTerms: row?.deliveryTerms || d.deliveryTerms,
    paymentTerms: row?.paymentTerms || d.paymentTerms,
    termsText: row?.termsText || d.termsText,
    contacts: row?.contacts ?? [],
    managingDirectors: row?.managingDirectors ?? [],
    registerCourt: row?.registerCourt ?? "",
    registerNumber: row?.registerNumber ?? "",
    jurisdiction: row?.jurisdiction ?? "",
    taxNumber: row?.taxNumber ?? "",
    vatId: row?.vatId ?? "",
    bankAccounts: row?.bankAccounts ?? [],
  };

  // Inline logos as data URIs so the live preview (react-pdf) can embed them
  // without a cross-origin fetch to object storage.
  const toDataUri = async (key: string): Promise<string | null> => {
    try {
      const { body, contentType } = await storageService.download(key);
      return `data:${contentType};base64,${body.toString("base64")}`;
    } catch {
      return null;
    }
  };

  const initialLogoDataUri = row?.logoUrl ? await toDataUri(row.logoUrl) : null;
  const initialFooterLogos = (
    await Promise.all(
      (row?.footerLogos ?? []).map(async (key) => {
        const dataUri = await toDataUri(key);
        return dataUri ? { key, dataUri } : null;
      }),
    )
  ).filter((f): f is { key: string; dataUri: string } => f !== null);

  return (
    <QuoteTemplateForm
      orgSlug={orgSlug}
      initial={initial}
      initialLogoDataUri={initialLogoDataUri}
      initialFooterLogos={initialFooterLogos}
      s={s}
      onSave={saveQuoteTemplate}
      onUploadLogo={uploadTemplateLogo}
      onRemoveLogo={removeTemplateLogo}
      onUploadFooterLogo={uploadFooterLogo}
      onRemoveFooterLogo={removeFooterLogo}
    />
  );
}
