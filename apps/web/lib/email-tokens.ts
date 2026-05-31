// Token substitution for email templates. Tokens are written as {tokenName} and
// replaced case-sensitively. Unknown tokens are left untouched so a typo is
// visible rather than silently blanked.

export const EMAIL_TEMPLATE_TOKENS = ["rfqNumber", "companyName", "contactName"] as const;

export type EmailToken = (typeof EMAIL_TEMPLATE_TOKENS)[number];

export type TokenValues = Record<EmailToken, string>;

export function renderTokens(template: string, values: TokenValues): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key as EmailToken] : match,
  );
}

/**
 * Build token values from an RFQ. `rfqNumber` is rendered with the leading "#"
 * the product uses elsewhere; contact/company fall back to polite placeholders
 * so a token never renders empty in a customer-facing draft.
 */
export function tokensFromRfq(rfq: {
  rfqNumber: number;
  companyName: string | null;
  contactName: string | null;
}): TokenValues {
  return {
    rfqNumber: `#${rfq.rfqNumber}`,
    companyName: rfq.companyName?.trim() || "your company",
    contactName: rfq.contactName?.trim() || "Sir or Madam",
  };
}
