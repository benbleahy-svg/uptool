// The DIN 5008 quote document (@react-pdf/renderer). Driven entirely by the saved
// quote_template (via DocTemplate) plus RFQ-derived recipient/info and the quote
// positions. Drives the Send-page preview, Download, Print, the email attachment,
// and the settings live preview. All labels come from the locale strings map and
// all numbers/dates/currency from Intl — switching the template locale to de-*
// yields a German quote with no code change.

import {
  createFormatters,
  defaultCurrencyForLocale,
  stringsForLocale,
} from "@/lib/quoting/quote-i18n";
import {
  type DocInfo,
  type DocPosition,
  type DocRecipient,
  type DocTemplate,
  computeTotals,
  isRegisteredForm,
  validUntilISO,
} from "@/lib/quoting/quote-doc";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface QuoteDocumentProps {
  template: DocTemplate;
  recipient: DocRecipient;
  info: DocInfo;
  positions: DocPosition[];
}

const INK = "#1a1a1a";
const MUTED = "#555";
const FAINT = "#888";
const LINE = "#bbb";
const HAIR = "#ddd";

// Positions table column widths (sum 100%).
const COL = { item: "9%", qty: "9%", unit: "9%", desc: "44%", unitPrice: "14.5%", total: "14.5%" };

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 50,
    paddingBottom: 132,
    fontSize: 9,
    color: INK,
    fontFamily: "Helvetica",
    lineHeight: 1.35,
  },

  // Letterhead
  letterhead: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 },
  logoBox: { alignItems: "flex-end" },
  logoImg: { maxWidth: 150, maxHeight: 56, objectFit: "contain" },
  logoMono: { fontSize: 18, fontFamily: "Helvetica-Bold", color: INK },
  slogan: { marginTop: 3, fontSize: 8, fontStyle: "italic", color: MUTED },

  // Address + info
  addrRow: { flexDirection: "row", marginBottom: 18 },
  addrCol: { width: "55%", paddingRight: 16 },
  senderLine: {
    fontSize: 7,
    color: FAINT,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingBottom: 2,
    marginBottom: 6,
  },
  recipientName: { fontFamily: "Helvetica-Bold" },
  infoCol: { width: "45%" },
  infoPlaceDate: { marginBottom: 6, fontFamily: "Helvetica-Bold" },
  infoRow: { flexDirection: "row", marginBottom: 1.5 },
  infoLabel: { width: "45%", color: MUTED },
  infoValue: { width: "55%" },

  subject: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 10 },
  intro: { marginBottom: 12 },

  // Positions table
  table: { marginBottom: 10 },
  thead: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    backgroundColor: "#f4f4f4",
    paddingVertical: 4,
  },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, paddingHorizontal: 4 },
  groupHeader: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIR,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIR,
  },
  cell: { fontSize: 8.5, paddingHorizontal: 4 },
  cellRight: { fontSize: 8.5, paddingHorizontal: 4, textAlign: "right" },
  partTitle: { fontFamily: "Helvetica-Bold" },
  partSub: { fontSize: 8, color: MUTED },

  // Totals
  totals: { alignItems: "flex-end", marginBottom: 12 },
  totalRow: { flexDirection: "row", width: 240, justifyContent: "space-between", paddingVertical: 1.5 },
  totalLabel: { color: MUTED },
  grandRow: {
    flexDirection: "row",
    width: 240,
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    marginTop: 3,
    paddingTop: 3,
  },
  grandText: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  smallBiz: { width: 320, fontSize: 8, color: MUTED, textAlign: "right" },

  conditions: { marginBottom: 12 },
  condLine: { flexDirection: "row", marginBottom: 1.5 },
  condLabel: { width: 90, color: MUTED },

  contactsBlock: { marginBottom: 12 },
  contactsIntro: { marginBottom: 4 },
  contactRow: { marginBottom: 2 },
  contactName: { fontFamily: "Helvetica-Bold" },

  closing: { marginBottom: 14 },

  tncTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 4 },
  tnc: { fontSize: 7.5, color: "#444", lineHeight: 1.4 },

  // Legal footer (Pflichtangaben) — fixed on every page
  footer: {
    position: "absolute",
    left: 50,
    right: 50,
    bottom: 24,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 5,
  },
  sheet: {
    position: "absolute",
    bottom: 116,
    left: 50,
    right: 50,
    textAlign: "right",
    fontSize: 6.5,
    color: FAINT,
  },
  footerCols: { flexDirection: "row" },
  footerCol: { flex: 1, paddingRight: 8 },
  footerLogos: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  footerLogo: { width: 28, height: 28, objectFit: "contain" },
  ftText: { fontSize: 6.5, color: MUTED, lineHeight: 1.4 },
  ftStrong: { fontSize: 6.5, color: INK, fontFamily: "Helvetica-Bold" },
});

function monogram(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "—"
  );
}

export function QuoteDocument({ template: tpl, recipient, info, positions }: QuoteDocumentProps) {
  const strings = stringsForLocale(tpl.locale);
  const currency = tpl.currency || defaultCurrencyForLocale(tpl.locale);
  const fmt = createFormatters(tpl.locale, currency);
  const totals = computeTotals(positions, tpl.vatRate, tpl.smallBusiness);
  const validUntil = validUntilISO(info.dateISO, tpl.validityDays);
  const subject = tpl.subjectTemplate
    .replace(/\{quoteNo\}/g, info.quoteNo)
    .replace(/\{quoteNumber\}/g, info.quoteNo)
    .replace(/\{projectNo\}/g, info.projectNo);
  const showRegister = isRegisteredForm(tpl.legalForm);

  // Empty-value omission (FIX 1): drop blanks so no label renders without a value.
  const cityLine = [tpl.postalCode, tpl.city].filter(Boolean).join(" ");
  const senderLine = [tpl.companyName, tpl.street, cityLine].filter(Boolean).join(" · ");
  const recipientCityLine = [recipient.postalCode, recipient.city].filter(Boolean).join(" ");
  const directors = tpl.managingDirectors.filter((d) => d.trim() !== "");
  const visibleContacts = tpl.contacts.filter((c) => c.name.trim() !== "");
  const visibleBanks = tpl.bankAccounts.filter((b) => b.bankName || b.iban || b.bic);
  const hasRegister = showRegister && (!!tpl.registerCourt || !!tpl.registerNumber);

  return (
    <Document title={`${strings.quoteNo} ${info.quoteNo}`} author={tpl.companyName}>
      <Page size="A4" style={s.page}>
        {/* 1 — Letterhead */}
        <View style={s.letterhead}>
          <View style={s.logoBox}>
            {tpl.logoUrl ? (
              <Image src={tpl.logoUrl} style={s.logoImg} />
            ) : (
              <Text style={s.logoMono}>{monogram(tpl.companyName)}</Text>
            )}
            {tpl.slogan ? <Text style={s.slogan}>{tpl.slogan}</Text> : null}
          </View>
        </View>

        {/* 2–4 — Sender line, recipient, info block */}
        <View style={s.addrRow}>
          <View style={s.addrCol}>
            <Text style={s.senderLine}>{senderLine}</Text>
            {recipient.organization ? (
              <Text style={s.recipientName}>{recipient.organization}</Text>
            ) : null}
            {recipient.contactName ? <Text>{recipient.contactName}</Text> : null}
            {recipient.street ? <Text>{recipient.street}</Text> : null}
            {recipientCityLine ? <Text>{recipientCityLine}</Text> : null}
            {recipient.country ? <Text>{recipient.country}</Text> : null}
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoPlaceDate}>
              {`${tpl.senderPlace ? `${tpl.senderPlace}, ` : ""}${fmt.date(info.dateISO)}`}
            </Text>
            <InfoRow label={strings.customerNo} value={info.customerNo} />
            <InfoRow label={strings.projectNo} value={info.projectNo} />
            <InfoRow label={strings.orderedBy} value={info.orderedBy} />
            <InfoRow label={strings.quoteNo} value={info.quoteNo} />
            <InfoRow label={strings.validUntil} value={fmt.date(validUntil)} />
            {info.deliveryDateISO && (
              <InfoRow label={strings.deliveryDate} value={fmt.date(info.deliveryDateISO)} />
            )}
          </View>
        </View>

        {/* 5 — Subject */}
        <Text style={s.subject}>{subject}</Text>

        {/* 6 — Intro */}
        {tpl.introText ? <Text style={s.intro}>{tpl.introText}</Text> : null}

        {/* 7 — Positions table */}
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, { width: COL.item }]}>{strings.item}</Text>
            <Text style={[s.th, { width: COL.qty }]}>{strings.qty}</Text>
            <Text style={[s.th, { width: COL.unit }]}>{strings.unit}</Text>
            <Text style={[s.th, { width: COL.desc }]}>{strings.description}</Text>
            <Text style={[s.th, { width: COL.unitPrice, textAlign: "right" }]}>
              {strings.unitPrice}
            </Text>
            <Text style={[s.th, { width: COL.total, textAlign: "right" }]}>{strings.totalPrice}</Text>
          </View>

          {positions.map((p, gi) => (
            <View key={`${p.partNumber}-${gi}`} wrap={false}>
              {/* Group header — the part */}
              <View style={s.groupHeader}>
                <Text style={[s.cell, { width: COL.item }]}>{String(gi + 1)}</Text>
                <Text style={[s.cell, { width: COL.qty }]}> </Text>
                <Text style={[s.cell, { width: COL.unit }]}> </Text>
                <View style={[s.cell, { width: COL.desc }]}>
                  <Text style={s.partTitle}>
                    {`${p.partNumber}${p.revision ? ` ${strings.rev} ${p.revision}` : ""}`}
                  </Text>
                  {p.description ? <Text>{p.description}</Text> : null}
                  {p.note ? <Text style={s.partSub}>{p.note}</Text> : null}
                </View>
                <Text style={[s.cellRight, { width: COL.unitPrice }]}> </Text>
                <Text style={[s.cellRight, { width: COL.total }]}> </Text>
              </View>
              {/* Sub-positions — quote lines / variants */}
              {p.rows.map((r, ri) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered PDF rows
                <View key={`${gi}-${ri}`} style={s.row}>
                  <Text style={[s.cell, { width: COL.item }]}>{`${gi + 1}.${ri + 1}`}</Text>
                  <Text style={[s.cell, { width: COL.qty }]}>{String(r.quantity)}</Text>
                  <Text style={[s.cell, { width: COL.unit }]}>{r.unit || strings.unitPc}</Text>
                  <Text style={[s.cell, { width: COL.desc }]}>{r.leadTime || " "}</Text>
                  <Text style={[s.cellRight, { width: COL.unitPrice }]}>{fmt.money(r.unitPrice)}</Text>
                  <Text style={[s.cellRight, { width: COL.total }]}>{fmt.money(r.totalPrice)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* 8 — Totals */}
        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{strings.subtotal}</Text>
            <Text>{fmt.money(totals.net)}</Text>
          </View>
          {tpl.smallBusiness ? (
            <Text style={s.smallBiz}>{strings.smallBusinessNote}</Text>
          ) : (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{`${strings.vat} ${tpl.vatRate}%`}</Text>
              <Text>{fmt.money(totals.vat)}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandText}>{strings.total}</Text>
            <Text style={s.grandText}>{fmt.money(totals.gross)}</Text>
          </View>
        </View>

        {/* 9 — Conditions */}
        <View style={s.conditions}>
          {tpl.deliveryTerms ? (
            <View style={s.condLine}>
              <Text style={s.condLabel}>{strings.deliveryLabel}</Text>
              <Text>{tpl.deliveryTerms}</Text>
            </View>
          ) : null}
          {tpl.paymentTerms ? (
            <View style={s.condLine}>
              <Text style={s.condLabel}>{strings.paymentTermsLabel}</Text>
              <Text>{tpl.paymentTerms}</Text>
            </View>
          ) : null}
        </View>

        {/* 10 — Contacts (omit contacts with no name; omit block if none) */}
        {visibleContacts.length > 0 && (
          <View style={s.contactsBlock}>
            <Text style={s.contactsIntro}>{strings.contactsIntro}</Text>
            {visibleContacts.map((c) => (
              <View key={`${c.name}-${c.email}`} style={s.contactRow}>
                <Text>
                  {c.roleLabel ? `${c.roleLabel}: ` : ""}
                  <Text style={s.contactName}>{c.name}</Text>
                  {c.phone ? `  ${strings.directLine} ${c.phone}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 11 — Closing */}
        <View style={s.closing}>
          {tpl.closingText ? <Text>{tpl.closingText}</Text> : null}
          <Text style={s.partTitle}>{tpl.companyName}</Text>
        </View>

        {/* 12 — Terms & Conditions (flows onto further pages) */}
        {tpl.termsText ? <Text style={s.tnc}>{tpl.termsText}</Text> : null}

        {/* Page numbering — fixed on every page, above the legal footer.
            Known issue: react-pdf's `render` page-number paints in a minimal doc
            but not in this full document (cause not isolated). See ADR 0012. */}
        <Text
          style={s.sheet}
          fixed
          render={({ pageNumber, totalPages }) => `${strings.sheet} ${pageNumber} / ${totalPages}`}
        />

        {/* 13 — Four-column legal footer on every page. Empty rows omitted per
            column (FIX 1) so no label renders without a value. */}
        <View style={s.footer} fixed>
          <View style={s.footerCols}>
            {/* Col 1 — company + full address */}
            <View style={s.footerCol}>
              {tpl.companyName ? <Text style={s.ftStrong}>{tpl.companyName}</Text> : null}
              {tpl.street ? <Text style={s.ftText}>{tpl.street}</Text> : null}
              {cityLine ? <Text style={s.ftText}>{cityLine}</Text> : null}
              {tpl.country ? <Text style={s.ftText}>{tpl.country}</Text> : null}
            </View>
            {/* Col 2 — phone / fax / email / website */}
            <View style={s.footerCol}>
              {tpl.phone ? <Text style={s.ftText}>{`${strings.tel} ${tpl.phone}`}</Text> : null}
              {tpl.fax ? <Text style={s.ftText}>{`${strings.fax} ${tpl.fax}`}</Text> : null}
              {tpl.email ? <Text style={s.ftText}>{`${strings.emailLabel} ${tpl.email}`}</Text> : null}
              {tpl.website ? <Text style={s.ftText}>{`${strings.web} ${tpl.website}`}</Text> : null}
            </View>
            {/* Col 3 — jurisdiction / register / directors / tax / VAT */}
            <View style={s.footerCol}>
              {tpl.jurisdiction ? (
                <Text style={s.ftText}>{`${strings.jurisdiction} ${tpl.jurisdiction}`}</Text>
              ) : null}
              {hasRegister ? (
                <Text style={s.ftText}>
                  {`${strings.commercialRegister} ${[tpl.registerCourt, tpl.registerNumber].filter(Boolean).join(" ")}`}
                </Text>
              ) : null}
              {directors.length > 0 ? (
                <Text style={s.ftText}>{`${strings.managingDirectors} ${directors.join(", ")}`}</Text>
              ) : null}
              {tpl.taxNumber ? (
                <Text style={s.ftText}>{`${strings.taxNumber} ${tpl.taxNumber}`}</Text>
              ) : null}
              {tpl.vatId ? <Text style={s.ftText}>{`${strings.vatIdLabel} ${tpl.vatId}`}</Text> : null}
            </View>
            {/* Col 4 — bank account(s), each on its own line */}
            <View style={s.footerCol}>
              {visibleBanks.map((b) => (
                <View key={b.iban || b.bankName} style={{ marginBottom: 2 }}>
                  {b.bankName ? <Text style={s.ftStrong}>{b.bankName}</Text> : null}
                  {b.iban ? <Text style={s.ftText}>{`${strings.iban} ${b.iban}`}</Text> : null}
                  {b.bic ? <Text style={s.ftText}>{`${strings.bic} ${b.bic}`}</Text> : null}
                </View>
              ))}
            </View>
            {tpl.footerLogoUrls.length > 0 && (
              <View style={s.footerLogos}>
                {tpl.footerLogoUrls.map((uri) => (
                  <Image key={uri} src={uri} style={s.footerLogo} />
                ))}
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}
