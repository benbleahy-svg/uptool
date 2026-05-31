// All user-visible strings for the Quote Template settings page, keyed by
// locale. English now; `de` is a stub (a few headings translated to prove the
// machinery — the rest fall back to English) so localizing later is a pure data
// change. Default UI locale is "en"; the stored quote `locale`/`currency` drive
// the document's Intl formatting (Prompt 11), not this settings chrome.

export interface TemplateStrings {
  pageTitle: string;
  pageSubtitle: string;
  save: string;
  saving: string;
  saved: string;
  reset: string;
  add: string;
  remove: string;

  // Section headings
  sLogo: string;
  sSender: string;
  sTax: string;
  sQuoteText: string;
  sTerms: string;
  sContacts: string;
  sTermsConditions: string;
  sLegal: string;
  sBank: string;

  // Logo & letterhead
  logo: string;
  logoHint: string;
  logoUpload: string;
  logoRemove: string;
  slogan: string;
  sloganPlaceholder: string;

  // Sender & company
  companyName: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  senderPlace: string;
  senderPlaceHint: string;

  // Tax & currency
  localeLabel: string;
  currency: string;
  vatRate: string;
  reducedVatRate: string;
  smallBusiness: string;
  smallBusinessHint: string;

  // Quote text
  subjectTemplate: string;
  subjectHint: string;
  introText: string;
  closingText: string;
  validityDays: string;

  // Terms
  deliveryTerms: string;
  paymentTerms: string;

  // Contacts
  contactRole: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  addContact: string;
  noContacts: string;

  // Terms & conditions
  termsText: string;

  // Legal footer
  legalHint: string;
  managingDirectors: string;
  directorName: string;
  addDirector: string;
  registerCourt: string;
  registerNumber: string;
  jurisdiction: string;
  taxNumber: string;
  vatId: string;

  // Bank accounts
  bankName: string;
  iban: string;
  bic: string;
  ibanInvalid: string;
  addBank: string;
  noBanks: string;

  legalForms: Record<string, string>;
  localeOptions: { value: string; label: string }[];
  currencyOptions: { value: string; label: string }[];

  defaults: {
    introText: string;
    closingText: string;
    subjectTemplate: string;
    deliveryTerms: string;
    paymentTerms: string;
    termsText: string;
  };
}

const en: TemplateStrings = {
  pageTitle: "Quote Template",
  pageSubtitle:
    "Enter your company, legal, and commercial details once. These feed the quote PDF on the Send page.",
  save: "Save",
  saving: "Saving…",
  saved: "Quote template saved",
  reset: "Reset",
  add: "Add",
  remove: "Remove",

  sLogo: "Logo & Letterhead",
  sSender: "Sender & Company",
  sTax: "Tax & Currency",
  sQuoteText: "Quote Text",
  sTerms: "Terms",
  sContacts: "Contacts",
  sTermsConditions: "Terms & Conditions",
  sLegal: "Legal Footer",
  sBank: "Bank Accounts",

  logo: "Logo",
  logoHint: "PNG, JPG or SVG, up to 1 MB. Shown on the quote letterhead.",
  logoUpload: "Upload logo",
  logoRemove: "Remove",
  slogan: "Slogan",
  sloganPlaceholder: "e.g. Welcome to the possible",

  companyName: "Company Name",
  legalForm: "Legal Form",
  street: "Street",
  postalCode: "Postal Code",
  city: "City",
  country: "Country",
  phone: "Phone",
  fax: "Fax",
  email: "Email",
  website: "Website",
  senderPlace: "Sender Location",
  senderPlaceHint: "Used in the “{Location}, {Date}” line, e.g. Lienen.",

  localeLabel: "Language / Locale",
  currency: "Currency",
  vatRate: "VAT Rate (%)",
  reducedVatRate: "Reduced VAT Rate (%)",
  smallBusiness: "Small business (no VAT, § 19 UStG)",
  smallBusinessHint:
    "When enabled, no VAT is charged and a small-business note replaces the VAT line.",

  subjectTemplate: "Subject Template",
  subjectHint: "{quoteNo} is replaced with the quote number.",
  introText: "Intro Text",
  closingText: "Closing",
  validityDays: "Validity (days)",

  deliveryTerms: "Delivery Terms",
  paymentTerms: "Payment Terms",

  contactRole: "Role",
  contactName: "Name",
  contactPhone: "Direct Line",
  contactEmail: "Email",
  addContact: "Add Contact",
  noContacts: "No contacts yet.",

  termsText: "Terms & Conditions",

  legalHint:
    "Legally required on German business correspondence (DIN 5008 / § 35a GmbHG, § 37a HGB).",
  managingDirectors: "Managing Directors",
  directorName: "Name",
  addDirector: "Add Director",
  registerCourt: "Register Court",
  registerNumber: "Register Number",
  jurisdiction: "Jurisdiction",
  taxNumber: "Tax Number",
  vatId: "VAT ID",

  bankName: "Bank Name",
  iban: "IBAN",
  bic: "BIC",
  ibanInvalid: "Enter a valid IBAN.",
  addBank: "Add Bank Account",
  noBanks: "No bank accounts yet.",

  legalForms: {
    sole_trader: "Sole Trader",
    eK: "Registered Merchant (e.K.)",
    GbR: "GbR (Civil-law Partnership)",
    GmbH: "GmbH",
    UG: "UG (haftungsbeschränkt)",
    AG: "AG",
    GmbH_Co_KG: "GmbH & Co. KG",
    OHG: "OHG",
    KG: "KG",
    other: "Other",
  },

  localeOptions: [
    { value: "en-US", label: "English (US)" },
    { value: "en-GB", label: "English (UK)" },
    { value: "de-DE", label: "German (Germany)" },
  ],
  currencyOptions: [
    { value: "EUR", label: "Euro (€)" },
    { value: "USD", label: "US Dollar ($)" },
    { value: "GBP", label: "British Pound (£)" },
    { value: "CHF", label: "Swiss Franc (CHF)" },
  ],

  defaults: {
    introText:
      "Dear Sir or Madam,\n\nthank you for your enquiry. We are pleased to offer the following:",
    closingText: "Kind regards",
    subjectTemplate: "Quote No. {quoteNo}",
    deliveryTerms: "ex works",
    paymentTerms: "Net 14 days.",
    termsText:
      "1. All prices are quoted in the stated currency and are exclusive of statutory VAT unless noted otherwise.\n2. This quotation is valid for the period stated above.\n3. Delivery and payment terms are as specified in this document.\n4. Goods remain our property until paid in full.\n\n(Placeholder terms — replace with your own terms and conditions before sending quotes.)",
  },
};

// de stub — a few headings translated to demonstrate the data-only switch;
// everything else falls back to English until properly localized.
const de: TemplateStrings = {
  ...en,
  pageTitle: "Angebotsvorlage",
  pageSubtitle:
    "Erfassen Sie Ihre Firmen-, Rechts- und Geschäftsdaten einmalig. Diese fließen in das Angebots-PDF ein.",
  save: "Speichern",
  reset: "Zurücksetzen",
  sLogo: "Logo & Briefkopf",
  sSender: "Absender & Firma",
  sTax: "Steuer & Währung",
  sQuoteText: "Angebotstext",
  sTerms: "Konditionen",
  sContacts: "Ansprechpartner",
  sTermsConditions: "Allgemeine Geschäftsbedingungen",
  sLegal: "Pflichtangaben",
  sBank: "Bankverbindungen",
};

const STRINGS: Record<"en" | "de", TemplateStrings> = { en, de };

export function getTemplateStrings(locale = "en"): TemplateStrings {
  return locale.toLowerCase().startsWith("de") ? STRINGS.de : STRINGS.en;
}
