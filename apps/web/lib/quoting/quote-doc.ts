// Plain (no react-pdf) data layer for the DIN 5008 quote document. Shared by the
// Send page and the settings live preview. The document template is the saved
// quote_template plus inlined logo data URIs; recipient/info come from the RFQ;
// positions are mapped from the client quote snapshot.

import type { QuoteTemplateInput } from "@uptool/services";
import type { QuoteSnapshot } from "./quote-store";

// Render-time template: logos are URLs (or data URIs) resolved server-side.
// Built inside the /api/quote-pdf route from a QuotePdfRequest — never assembled
// on the client.
export type DocTemplate = QuoteTemplateInput & {
  logoUrl: string | null;
  footerLogoUrls: string[];
};

// Wire payload the client POSTs to /api/quote-pdf. Logos travel as storage keys;
// the server resolves them (so the client never handles image bytes/data URIs).
export type DocTemplateSpec = QuoteTemplateInput & {
  logoKey: string | null;
  footerLogoKeys: string[];
};

export interface QuotePdfRequest {
  orgSlug: string;
  template: DocTemplateSpec;
  recipient: DocRecipient;
  info: DocInfo;
  positions: DocPosition[];
}

export interface DocRecipient {
  organization: string;
  contactName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface DocInfo {
  customerNo: string;
  projectNo: string;
  orderedBy: string;
  quoteNo: string;
  dateISO: string;
  deliveryDateISO: string | null;
}

export interface DocPositionRow {
  quantity: number;
  /** "" → the document falls back to the localized default unit. */
  unit: string;
  /** Variant differentiator (e.g. lead time), shown under the sub-position. */
  leadTime: string;
  unitPrice: number;
  totalPrice: number;
}

export interface DocPosition {
  partNumber: string;
  revision: string;
  description: string;
  note: string;
  rows: DocPositionRow[];
}

// Legal forms entered in a commercial register → footer shows Register Court/No.
const REGISTERED = new Set(["eK", "GmbH", "UG", "AG", "GmbH_Co_KG", "OHG", "KG"]);
export function isRegisteredForm(legalForm: string): boolean {
  return REGISTERED.has(legalForm);
}

export function positionsFromSnapshot(snapshot: QuoteSnapshot): DocPosition[] {
  return snapshot.items.map((it) => ({
    partNumber: it.partNumber,
    revision: it.revision,
    description: it.description,
    note: it.note,
    rows: it.rows.map((r) => ({
      quantity: r.quantity,
      unit: "",
      leadTime: r.leadTime,
      unitPrice: r.unitPrice,
      totalPrice: r.totalPrice,
    })),
  }));
}

/** Persisted quote_line_items (+ its part) reshaped for positionsFromLineItems. */
export interface LineItemForDoc {
  partId: string | null;
  partNumber: string | null;
  revision: string | null;
  description: string | null;
  notesExternal: string | null;
  quantity: number;
  leadTimeWeeks: number | null;
  unitPriceCents: number;
  totalPriceCents: number;
}

/** Group persisted line items by part (first-seen order) into DIN doc positions.
 *  Prices are cents → euros; lead time formats weeks. The server send path uses
 *  this instead of positionsFromSnapshot — one source of truth (persisted rows). */
export function positionsFromLineItems(items: LineItemForDoc[]): DocPosition[] {
  const positions: DocPosition[] = [];
  const indexByPart = new Map<string, number>();
  for (const it of items) {
    const key = it.partId ?? `n:${it.partNumber ?? ""}`;
    let idx = indexByPart.get(key);
    if (idx === undefined) {
      idx = positions.length;
      indexByPart.set(key, idx);
      positions.push({
        partNumber: it.partNumber ?? "—",
        revision: it.revision ?? "",
        description: it.description ?? "",
        note: it.notesExternal ?? "",
        rows: [],
      });
    }
    positions[idx]?.rows.push({
      quantity: it.quantity,
      unit: "",
      leadTime:
        it.leadTimeWeeks == null
          ? ""
          : `${it.leadTimeWeeks} ${it.leadTimeWeeks === 1 ? "week" : "weeks"}`,
      unitPrice: it.unitPriceCents / 100,
      totalPrice: it.totalPriceCents / 100,
    });
  }
  return positions;
}

export interface DocTotals {
  net: number;
  vat: number;
  gross: number;
}

export function computeTotals(
  positions: DocPosition[],
  vatRatePct: number,
  smallBusiness: boolean,
): DocTotals {
  const net = positions.reduce((s, p) => s + p.rows.reduce((a, r) => a + r.totalPrice, 0), 0);
  const vat = smallBusiness ? 0 : net * (vatRatePct / 100);
  return { net, vat, gross: net + vat };
}

/** Today + validityDays, as an ISO string (document formats it per locale). */
export function validUntilISO(dateISO: string, validityDays: number): string {
  return new Date(Date.parse(dateISO) + validityDays * 86_400_000).toISOString();
}

// ─── Sample data for the settings live preview ────────────────────────────────

export const SAMPLE_RECIPIENT: DocRecipient = {
  organization: "Tesla Manufacturing GmbH",
  contactName: "Alex Huckstepp",
  street: "Gigafactory-Straße 1",
  postalCode: "16515",
  city: "Grünheide",
  country: "Germany",
};

export const SAMPLE_INFO: DocInfo = {
  customerNo: "10042",
  projectNo: "P-2026-018",
  orderedBy: "Alex Huckstepp",
  quoteNo: "1194",
  dateISO: "2026-05-30T00:00:00.000Z",
  deliveryDateISO: null,
};

export const SAMPLE_POSITIONS: DocPosition[] = [
  {
    partNumber: "5216488",
    revision: "A",
    description: "Base plate, vent plate",
    note: "Finishing per drawing",
    rows: [
      { quantity: 1, unit: "", leadTime: "2 week (expedite)", unitPrice: 521.85, totalPrice: 521.85 },
      { quantity: 10, unit: "", leadTime: "3 weeks", unitPrice: 86.16, totalPrice: 861.6 },
      { quantity: 100, unit: "", leadTime: "5 weeks", unitPrice: 60.36, totalPrice: 6036 },
    ],
  },
  {
    partNumber: "4990202",
    revision: "A",
    description: "Mounting bracket, collar",
    note: "",
    rows: [
      { quantity: 1, unit: "", leadTime: "3 weeks", unitPrice: 796.31, totalPrice: 796.31 },
      { quantity: 10, unit: "", leadTime: "5 weeks", unitPrice: 147.82, totalPrice: 1478.2 },
    ],
  },
];
