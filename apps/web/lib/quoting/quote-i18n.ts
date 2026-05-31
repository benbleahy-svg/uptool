// Locale-keyed labels + Intl formatters for the quote DOCUMENT (DIN 5008 layout).
// English now; `de` carries real German so switching the org locale to de-* (with
// EUR) yields a fully German quote with no code change. All document text content
// (intro, terms, payment/delivery, etc.) comes from the saved quote_template —
// only the fixed field LABELS live here.

export interface QuoteStrings {
  // Info block
  customerNo: string;
  projectNo: string;
  orderedBy: string;
  quoteNo: string;
  validUntil: string;
  deliveryDate: string;

  // Positions table
  item: string;
  qty: string;
  unit: string;
  description: string;
  unitPrice: string;
  totalPrice: string;
  unitPc: string;
  rev: string;

  // Totals
  subtotal: string;
  vat: string;
  total: string;
  smallBusinessNote: string;

  // Conditions
  deliveryLabel: string;
  paymentTermsLabel: string;

  // Contacts + closing
  contactsIntro: string;
  directLine: string;

  // Legal footer
  tel: string;
  fax: string;
  emailLabel: string;
  web: string;
  jurisdiction: string;
  commercialRegister: string;
  managingDirectors: string;
  taxNumber: string;
  vatIdLabel: string;
  bankLabel: string;
  iban: string;
  bic: string;
  sheet: string;
}

const en: QuoteStrings = {
  customerNo: "Customer No.",
  projectNo: "Project No.",
  orderedBy: "Ordered by",
  quoteNo: "Quote No.",
  validUntil: "Valid until",
  deliveryDate: "Delivery date",

  item: "Item",
  qty: "Qty",
  unit: "Unit",
  description: "Description",
  unitPrice: "Unit Price",
  totalPrice: "Total Price",
  unitPc: "pc",
  rev: "Rev",

  subtotal: "Subtotal",
  vat: "VAT",
  total: "Total",
  smallBusinessNote: "No VAT is charged under the small-business regulation (§ 19 UStG).",

  deliveryLabel: "Delivery:",
  paymentTermsLabel: "Payment terms:",

  contactsIntro: "For questions, please contact:",
  directLine: "Direct line:",

  tel: "Tel.",
  fax: "Fax",
  emailLabel: "Email",
  web: "Web",
  jurisdiction: "Jurisdiction:",
  commercialRegister: "Commercial Register:",
  managingDirectors: "Managing Directors:",
  taxNumber: "Tax No.:",
  vatIdLabel: "VAT ID:",
  bankLabel: "Bank:",
  iban: "IBAN:",
  bic: "BIC:",
  sheet: "Sheet",
};

const de: QuoteStrings = {
  customerNo: "Kundennr.",
  projectNo: "Projektnr.",
  orderedBy: "Bestellt von",
  quoteNo: "Angebotsnr.",
  validUntil: "Gültig bis",
  deliveryDate: "Lieferdatum",

  item: "Pos.",
  qty: "Menge",
  unit: "Einheit",
  description: "Bezeichnung",
  unitPrice: "Einzelpreis",
  totalPrice: "Gesamtpreis",
  unitPc: "Stk",
  rev: "Rev",

  subtotal: "Zwischensumme",
  vat: "MwSt.",
  total: "Gesamt",
  smallBusinessNote: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",

  deliveryLabel: "Lieferung:",
  paymentTermsLabel: "Zahlungsbedingungen:",

  contactsIntro: "Bei Fragen wenden Sie sich bitte an:",
  directLine: "Durchwahl:",

  tel: "Tel.",
  fax: "Fax",
  emailLabel: "E-Mail",
  web: "Web",
  jurisdiction: "Gerichtsstand:",
  commercialRegister: "Handelsregister:",
  managingDirectors: "Geschäftsführer:",
  taxNumber: "Steuernr.:",
  vatIdLabel: "USt-IdNr.:",
  bankLabel: "Bank:",
  iban: "IBAN:",
  bic: "BIC:",
  sheet: "Blatt",
};

/** German for any "de-*" locale, else English. */
export function stringsForLocale(locale: string): QuoteStrings {
  return locale.toLowerCase().startsWith("de") ? de : en;
}

/** Currency default when none is set (EUR for German locales, else USD). */
export function defaultCurrencyForLocale(locale: string): string {
  return locale.toLowerCase().startsWith("de") ? "EUR" : "USD";
}

export interface QuoteFormatters {
  money: (n: number) => string;
  date: (iso: string) => string;
}

/** Intl-backed currency + date formatters. de-DE/EUR → "1.234,56 €" / "TT.MM.JJJJ". */
export function createFormatters(locale: string, currency: string): QuoteFormatters {
  const currencyFmt = new Intl.NumberFormat(locale, { style: "currency", currency });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return {
    money: (n) => currencyFmt.format(n),
    date: (iso) => dateFmt.format(new Date(iso)),
  };
}
