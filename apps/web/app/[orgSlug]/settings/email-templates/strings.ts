// User-visible strings for the Email Templates settings page, keyed by locale.
// English now; `de` is a stub (headings translated) so localizing later is a
// pure data change — same mechanism as the Quote Template settings page. The
// template *content* defaults live in the service (DEFAULT_EMAIL_TEMPLATES).

export interface EmailTemplateStrings {
  pageTitle: string;
  pageSubtitle: string;
  save: string;
  saving: string;
  saved: string;
  reset: string;
  tokensHint: string;
  subjectLabel: string;
  bodyLabel: string;
  // Decline template section
  declineTitle: string;
  declineDescription: string;
}

const en: EmailTemplateStrings = {
  pageTitle: "Email Templates",
  pageSubtitle:
    "Reusable email drafts for common actions. Edit the wording; the draft is always shown for review before anything is sent.",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  reset: "Reset",
  tokensHint: "Available tokens: {rfqNumber}, {companyName}, {contactName}",
  subjectLabel: "Subject",
  bodyLabel: "Body",
  declineTitle: "Decline (No Bid)",
  declineDescription:
    "Sent when you decline an RFQ. Pre-drafted in Messaging for review before you send.",
};

const de: EmailTemplateStrings = {
  ...en,
  pageTitle: "E-Mail-Vorlagen",
  declineTitle: "Ablehnung (Kein Angebot)",
};

const STRINGS = { en, de } as const;

export function getEmailTemplateStrings(locale = "en"): EmailTemplateStrings {
  return locale.toLowerCase().startsWith("de") ? STRINGS.de : STRINGS.en;
}
