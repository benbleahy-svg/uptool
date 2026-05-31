import {
  db,
  quoteTemplates,
  type TemplateBankAccount,
  type TemplateContact,
} from "@uptool/db";

export type LegalForm =
  | "sole_trader"
  | "eK"
  | "GbR"
  | "GmbH"
  | "UG"
  | "AG"
  | "GmbH_Co_KG"
  | "OHG"
  | "KG"
  | "other";

/** Everything the form saves. Logo + footer logos are managed separately. */
export interface QuoteTemplateInput {
  slogan: string;
  companyName: string;
  legalForm: LegalForm;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  senderPlace: string;
  locale: string;
  currency: string;
  vatRate: number;
  reducedVatRate: number;
  smallBusiness: boolean;
  subjectTemplate: string;
  introText: string;
  closingText: string;
  validityDays: number;
  deliveryTerms: string;
  paymentTerms: string;
  termsText: string;
  contacts: TemplateContact[];
  managingDirectors: string[];
  registerCourt: string;
  registerNumber: string;
  jurisdiction: string;
  taxNumber: string;
  vatId: string;
  bankAccounts: TemplateBankAccount[];
}

export const quoteTemplateService = {
  /** One row per org; null until first save. */
  async get(orgId: string) {
    const row = await db.query.quoteTemplates.findFirst({
      where: (t, { eq }) => eq(t.orgId, orgId),
    });
    return row ?? null;
  },

  /**
   * Insert-or-update the org's template. Numeric VAT rates are stored as
   * strings (Postgres numeric). Logo + footer logos are untouched here — they
   * have their own setters so a save never clobbers an uploaded logo.
   */
  async upsert(orgId: string, input: QuoteTemplateInput) {
    const set = {
      ...input,
      vatRate: String(input.vatRate),
      reducedVatRate: String(input.reducedVatRate),
      updatedAt: new Date(),
    };
    await db
      .insert(quoteTemplates)
      .values({ orgId, ...set })
      .onConflictDoUpdate({ target: quoteTemplates.orgId, set });
  },

  async updateLogo(orgId: string, key: string | null) {
    await db
      .insert(quoteTemplates)
      .values({ orgId, logoUrl: key })
      .onConflictDoUpdate({
        target: quoteTemplates.orgId,
        set: { logoUrl: key, updatedAt: new Date() },
      });
  },

  async setFooterLogos(orgId: string, keys: string[]) {
    await db
      .insert(quoteTemplates)
      .values({ orgId, footerLogos: keys })
      .onConflictDoUpdate({
        target: quoteTemplates.orgId,
        set: { footerLogos: keys, updatedAt: new Date() },
      });
  },
};
