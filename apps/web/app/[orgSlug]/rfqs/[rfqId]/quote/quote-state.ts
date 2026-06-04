// Client-side quote model + price helpers. Rows mirror the persisted
// quote_line_items (cents). The page DISPLAYS the server-computed unit/total and
// only recomputes optimistically between an edit and its save landing. The
// whole-€ "Round Quote Unit Price" toggle is a display transform (never written).

import { parseDecimal } from "@/lib/quoting/materialCost";
import type { QuoteDocItem, QuoteSnapshot } from "@/lib/quoting/quote-store";

/** Part metadata for the Items column — from the real RFQ, not a mock. */
export interface QuotePartMeta {
  partId: string;
  partNumber: string;
  revision: string;
  description: string;
  noBid: boolean;
  /** External note (parts.notes_external — "printed on quote"); editable on the quote. */
  note: string;
  /** Server estimate unit cost (cents) per quantity break — snapshot source for new tiers. */
  estimateByQty: Array<{ quantity: number; costPerUnitCents: number }>;
}

/** A quote tier row. `id` is the DB id, or a temp id while a create is in flight. */
export interface QuoteLine {
  id: string;
  partId: string;
  quantity: number;
  /** Frozen estimate snapshot (cents). */
  costPerUnitCents: number;
  /** Markup % input (comma-tolerant); "" → 0; negative = discount. */
  markup: string;
  leadTimeWeeks: number | null;
  tierLabel: string | null;
  /** Server-computed — what we display. */
  quoteUnitPriceCents: number;
  quoteTotalCents: number;
  sortOrder: number;
}

/** Session-only grouping (Group Total persistence is deferred to its own epic). */
export interface QuoteGroup {
  id: string;
  name: string;
  lineIds: string[];
}

/**
 * Optimistic recompute mirroring the server (quoteService.computeQuotePrice):
 * round(cost × (1 + markup/100)) in cents. Used only between an edit and its save
 * landing; the server value reconciles in on success.
 */
export function computeQuoteUnitCents(costPerUnitCents: number, markup: string): number {
  const pct = markup.trim() === "" ? 0 : parseDecimal(markup);
  return Math.round(costPerUnitCents * (1 + pct / 100));
}

/** Whole-€ round toggle — display-only transform on the stored cents (never persisted). */
export function displayUnitCents(unitCents: number, round: boolean): number {
  return round ? Math.round(unitCents / 100) * 100 : unitCents;
}

/** Re-price a line from its frozen cost + current markup (optimistic; mirrors the
 *  server: round(cost × (1 + markup/100))). */
export function priced(line: QuoteLine): QuoteLine {
  const unit = computeQuoteUnitCents(line.costPerUnitCents, line.markup);
  return { ...line, quoteUnitPriceCents: unit, quoteTotalCents: unit * line.quantity };
}

/** The user-editable, per-row, debounced fields. */
export type EditableField = "markup" | "quantity" | "leadTimeWeeks" | "tierLabel";

/**
 * Field-scoped revert (mirrors the estimate's revertOpField): restore ONLY the
 * given fields from `before` onto the CURRENT line, re-pricing if markup/quantity
 * was restored. A failed save on one field must not clobber a sibling field that
 * was edited+committed separately.
 */
export function revertLineFields(
  current: QuoteLine,
  before: QuoteLine,
  fields: EditableField[],
): QuoteLine {
  let next = { ...current };
  for (const f of fields) {
    if (f === "markup") next.markup = before.markup;
    else if (f === "quantity") next.quantity = before.quantity;
    else if (f === "leadTimeWeeks") next.leadTimeWeeks = before.leadTimeWeeks;
    else if (f === "tierLabel") next.tierLabel = before.tierLabel;
  }
  if (fields.includes("markup") || fields.includes("quantity")) next = priced(next);
  return next;
}

const TEMP_PREFIX = "tmp-";
export const isTempId = (id: string) => id.startsWith(TEMP_PREFIX);
export const newTempId = () => `${TEMP_PREFIX}${crypto.randomUUID()}`;

/** Structural shape of a persisted quote_line_items row (what the server actions
 *  return). Kept here so both the Server Component (hydration) and the client
 *  (save-reconcile) map rows the same way without importing server types. */
export interface QuoteLineRow {
  id: string;
  partId: string | null;
  quantity: number;
  costPerUnitCents: number;
  markupPct: string;
  leadTimeWeeks: number | null;
  tierLabel: string | null;
  quoteUnitPriceCents: number | null;
  quoteTotalCents: number;
  sortOrder: number;
}

/** DB row → client line. quoteUnitPriceCents is nullable in the column; fall back
 *  to the same formula the server uses when a legacy row left it null. */
export function rowToLine(r: QuoteLineRow): QuoteLine {
  const markupNum = Number(r.markupPct);
  return {
    id: r.id,
    partId: r.partId ?? "",
    quantity: r.quantity,
    costPerUnitCents: r.costPerUnitCents,
    markup: markupNum === 0 ? "" : String(markupNum),
    leadTimeWeeks: r.leadTimeWeeks,
    tierLabel: r.tierLabel,
    quoteUnitPriceCents:
      r.quoteUnitPriceCents ?? computeQuoteUnitCents(r.costPerUnitCents, String(markupNum)),
    quoteTotalCents: r.quoteTotalCents,
    sortOrder: r.sortOrder,
  };
}

/**
 * Reconcile a completed add: replace the temp row with the real row if the temp
 * is still present; if it was removed mid-flight (rapid add→delete), report the
 * just-created row as an orphan to delete. Mirrors the estimate epic's E3 guard.
 */
export function reconcileAddedLine(
  lines: QuoteLine[],
  tempId: string,
  row: QuoteLineRow,
): { lines: QuoteLine[]; orphanId: string | null } {
  if (!lines.some((l) => l.id === tempId)) return { lines, orphanId: row.id };
  return { lines: lines.map((l) => (l.id === tempId ? rowToLine(row) : l)), orphanId: null };
}

// ─── Preview/Send snapshot (client store; the Send epic will source from DB) ────

function leadTimeLabel(weeks: number | null): string {
  if (weeks == null) return "";
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** Snapshot the current builder state for the Send page's client store. */
export function buildSnapshot(
  parts: QuotePartMeta[],
  lines: QuoteLine[],
  notes: Record<string, string>,
  quoteNote: string,
  quoteNumber: number,
  round: boolean,
): QuoteSnapshot {
  const items: QuoteDocItem[] = [];
  for (const part of parts) {
    if (part.noBid) continue;
    const partLines = lines.filter((l) => l.partId === part.partId);
    if (partLines.length === 0) continue;
    items.push({
      partId: part.partId,
      partNumber: part.partNumber,
      revision: part.revision,
      description: part.description,
      note: notes[part.partId] ?? part.note,
      rows: partLines.map((l) => {
        const unit = displayUnitCents(l.quoteUnitPriceCents, round) / 100;
        return {
          quantity: l.quantity,
          leadTime: leadTimeLabel(l.leadTimeWeeks),
          unitPrice: unit,
          totalPrice: unit * l.quantity,
        };
      }),
    });
  }
  return { quoteNumber, quoteNote, items };
}

/** Empty fallback when /send is reached without a client snapshot (Send epic
 *  will read persisted rows here). */
export function buildDefaultSnapshot(quoteNumber: number): QuoteSnapshot {
  return { quoteNumber, quoteNote: "", items: [] };
}
