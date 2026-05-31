// Single source for org-level quote customization. Epic 6 (Settings / Org
// Profile) will wire a real editor + DB columns; for now these are stubbed but
// read exclusively through getOrgProfile() so the document never hardcodes them.
//
// Values mirror the en-US demo in the screenshots. Switching `locale` to a
// "de-*" value (and optionally `currency`) renders a correct German quote — see
// quote-i18n.ts for how locale drives currency, dates, labels, and T&Cs.

export interface OrgProfile {
  companyName: string;
  addressLine: string;
  phone: string;
  email: string;
  /** Optional logo as a data/URL string for the PDF <Image>. Falls back to a monogram. */
  logoSrc?: string;
  /** BCP-47 locale, e.g. "en-US" or "de-DE". Drives dates, number/currency, strings. */
  locale: string;
  /** ISO 4217 currency. When omitted, defaults from the locale (de-* → EUR, else USD). */
  currency?: string;
  /** Free-text payment terms shown in the header. When omitted, the locale default is used. */
  paymentTerms?: string;
  /** Quote validity window; drives the expiration date. */
  quoteValidityDays: number;
  /** Page size for the rendered PDF. */
  pageSize: "A4" | "LETTER";
}

const STUB_PROFILE: OrgProfile = {
  companyName: "We Mill You Chill",
  addressLine: "1 Precision Drive, Detroit, Michigan 54321, USA",
  phone: "123-456-7890",
  email: "contact@wemillyouchill.com",
  locale: "en-US",
  // currency / paymentTerms intentionally omitted → derived from locale defaults.
  quoteValidityDays: 30,
  pageSize: "LETTER",
};

/**
 * Returns the org profile used to render quotes. `overrides` lets a caller (or a
 * future Epic 6 editor) supply real org-record values; anything omitted falls
 * back to the stub.
 */
export function getOrgProfile(overrides?: Partial<OrgProfile>): OrgProfile {
  return { ...STUB_PROFILE, ...overrides };
}
