import { type EmailTemplateEntry, db, emailTemplates } from "@uptool/db";

export type { EmailTemplateEntry };

// Known template types. Only "decline" is wired up; the union + the jsonb map let
// us add "quote_cover", follow-ups, etc. later without a migration or new columns.
export type EmailTemplateKey = "decline";

export type EmailTemplates = Partial<Record<EmailTemplateKey, EmailTemplateEntry>>;

// English defaults. Polite placeholder decline — NOT legal/contractual language.
// Locale-switchable later via the same strings/locale mechanism as the quote
// template; for now there is one (English) default per template type.
export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, EmailTemplateEntry> = {
  decline: {
    subject: "Re: {rfqNumber} — Quotation",
    body: [
      "Dear {contactName},",
      "",
      "Thank you for your enquiry {rfqNumber} and for considering us for this project.",
      "",
      "After careful review, we regret that we are unable to submit a quotation on this occasion. This is no reflection on {companyName} or your enquiry, and we would be glad to be considered for future opportunities.",
      "",
      "Thank you again for thinking of us, and we wish you every success with the project.",
      "",
      "Kind regards",
    ].join("\n"),
  },
};

export const emailTemplateService = {
  /** Raw row (or null if the org has never saved any email template). */
  async get(orgId: string) {
    const row = await db.query.emailTemplates.findFirst({
      where: (t, { eq }) => eq(t.orgId, orgId),
    });
    return row ?? null;
  },

  /** Stored templates merged over defaults — callers always get usable copy. */
  async resolve(orgId: string): Promise<Record<EmailTemplateKey, EmailTemplateEntry>> {
    const row = await emailTemplateService.get(orgId);
    const stored = (row?.templates ?? {}) as EmailTemplates;
    return {
      decline: stored.decline ?? DEFAULT_EMAIL_TEMPLATES.decline,
    };
  },

  async upsert(orgId: string, templates: EmailTemplates) {
    await db
      .insert(emailTemplates)
      .values({ orgId, templates })
      .onConflictDoUpdate({
        target: emailTemplates.orgId,
        set: { templates, updatedAt: new Date() },
      });
  },
};
