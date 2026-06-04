import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  orgName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  quoteTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: "#6B7280",
  },
  metaValue: {
    fontSize: 10,
    marginBottom: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#6B7280",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  colPart: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colLead: { flex: 1.5, textAlign: "right" },
  th: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#374151" },
  td: { fontSize: 10 },
  noBidText: { color: "#9CA3AF", fontStyle: "italic" },
  notes: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    fontSize: 9,
    color: "#6B7280",
  },
});

function centsToEuros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export interface OrgContact {
  phone?: string | null;
  website?: string | null;
  vatId?: string | null;
  address?: { street?: string; city?: string; postal?: string; country?: string } | null;
}

export interface QuotePdfProps {
  quoteNumber: number;
  orgName: string;
  orgContact?: OrgContact;
  customerName: string;
  contactEmail: string;
  createdAt: string;
  notesForCustomer: string;
  lineItems: Array<{
    partLabel: string;
    quantity: number;
    costPerUnitCents: number;
    markupPct: number;
    quotePriceCents: number;
    leadTimeWeeks: number | null;
    tierLabel?: string | null;
    isNoBid: boolean;
    notesExternal?: string | null;
  }>;
}

export function QuotePdf(props: QuotePdfProps): ReactElement<DocumentProps> {
  const dateStr = new Date(props.createdAt).toLocaleDateString("de-DE");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.orgName}>{props.orgName}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.quoteTitle}>Angebot #{props.quoteNumber}</Text>
            <Text style={styles.metaLabel}>Datum: {dateStr}</Text>
            <Text style={styles.metaLabel}>Kunde: {props.customerName}</Text>
            {props.contactEmail ? (
              <Text style={styles.metaLabel}>{props.contactEmail}</Text>
            ) : null}
          </View>
        </View>

        {/* Line items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Positionen</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.colPart, styles.th]}>Beschreibung</Text>
            <Text style={[styles.colQty, styles.th]}>Menge</Text>
            <Text style={[styles.colPrice, styles.th]}>Einzelpreis</Text>
            <Text style={[styles.colPrice, styles.th]}>Gesamtpreis</Text>
            <Text style={[styles.colLead, styles.th]}>Lieferzeit</Text>
          </View>
          {props.lineItems.map((li, i) => (
            <View key={`${li.partLabel}-${li.quantity}-${i}`}>
              <View style={styles.tableRow}>
                <View style={styles.colPart}>
                  <Text style={styles.td}>{li.partLabel}</Text>
                  {li.tierLabel ? (
                    <Text style={{ fontSize: 8, color: "#6B7280" }}>{li.tierLabel}</Text>
                  ) : null}
                </View>
                <Text style={[styles.colQty, styles.td]}>{li.quantity}</Text>
                {li.isNoBid ? (
                  <>
                    <Text style={[styles.colPrice, styles.td, styles.noBidText]}>—</Text>
                    <Text style={[styles.colPrice, styles.td, styles.noBidText]}>Kein Angebot</Text>
                    <Text style={[styles.colLead, styles.td, styles.noBidText]}>—</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.colPrice, styles.td]}>
                      {centsToEuros(li.quotePriceCents)}
                    </Text>
                    <Text style={[styles.colPrice, styles.td]}>
                      {centsToEuros(li.quotePriceCents * li.quantity)}
                    </Text>
                    <Text style={[styles.colLead, styles.td]}>
                      {li.leadTimeWeeks !== null ? `${li.leadTimeWeeks} Wo.` : "—"}
                    </Text>
                  </>
                )}
              </View>
              {li.notesExternal ? (
                <View style={{ paddingHorizontal: 8, paddingBottom: 4, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#E5E7EB" }}>
                  <Text style={{ fontSize: 9, color: "#6B7280" }}>{li.notesExternal}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {/* Notes */}
        {props.notesForCustomer ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hinweise</Text>
            <Text style={styles.notes}>{props.notesForCustomer}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Dieses Angebot ist 30 Tage gültig. Preise zzgl. gesetzlicher MwSt.</Text>
          {props.orgContact && (
            <Text style={{ marginTop: 4 }}>
              {[
                props.orgContact.address?.street,
                props.orgContact.address?.postal && props.orgContact.address.city
                  ? `${props.orgContact.address.postal} ${props.orgContact.address.city}`
                  : props.orgContact.address?.city,
                props.orgContact.phone,
                props.orgContact.website,
                props.orgContact.vatId ? `USt-IdNr.: ${props.orgContact.vatId}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}
