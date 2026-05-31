// Client-side quote state: lines, groups, and the price math. No DB persistence.

import { getCostShares } from "@/lib/quoting/estimateResults";
import type { BreakdownKey } from "@/lib/quoting/estimateTotals";
import { parseDecimal } from "@/lib/quoting/materialCost";
import type { QuoteDocItem, QuoteSnapshot } from "@/lib/quoting/quote-store";
import { DEFAULT_QUOTE_NOTE, QUOTE_PARTS } from "./quote-data";

/** Absolute four-category cost split for a line (sums to its estimate total). */
export type LineBreakdown = Record<BreakdownKey, number>;

export interface QuoteLine {
  id: string;
  partId: string;
  quantity: number;
  estimateUnitPrice: number;
  /** Percent as a (comma-tolerant) string; "" means 0%. Negative = discount. */
  markup: string;
  leadTime: string;
  /** Cost split sourced from the estimate computation (see getCostShares). */
  breakdown: LineBreakdown;
}

export interface QuoteGroup {
  id: string;
  name: string;
  lineIds: string[];
}

/** One priced line per part per quantity break (no-bid parts have none). */
export function buildInitialLines(): QuoteLine[] {
  const lines: QuoteLine[] = [];
  for (const part of QUOTE_PARTS) {
    if (part.noBid) continue;
    for (const e of part.estimates) {
      const estimateTotal = e.unitPrice * e.quantity;
      const shares = getCostShares(part.partId, e.quantity);
      lines.push({
        id: `${part.partId}-${e.quantity}`,
        partId: part.partId,
        quantity: e.quantity,
        estimateUnitPrice: e.unitPrice,
        markup: "",
        leadTime: "",
        breakdown: {
          materials: shares.materials * estimateTotal,
          nr: shares.nr * estimateTotal,
          recurring: shares.recurring * estimateTotal,
          outside: shares.outside * estimateTotal,
        },
      });
    }
  }
  return lines;
}

/** Quote unit price = estimate × (1 + markup/100), rounded to whole € when enabled. */
export function quoteUnitPrice(estimate: number, markup: string, round: boolean): number {
  const raw = estimate * (1 + parseDecimal(markup) / 100);
  return round ? Math.round(raw) : raw;
}

export function quoteTotalPrice(
  estimate: number,
  markup: string,
  quantity: number,
  round: boolean,
): number {
  return quoteUnitPrice(estimate, markup, round) * quantity;
}

/**
 * Snapshots the current quote (lines grouped by part, with computed prices) for
 * the Send page. Carries the applied variant rows and their lead times verbatim.
 */
export function buildSnapshot(
  lines: QuoteLine[],
  notes: Record<string, string>,
  quoteNote: string,
  quoteNumber: number,
  round: boolean,
): QuoteSnapshot {
  const items: QuoteDocItem[] = [];
  for (const part of QUOTE_PARTS) {
    if (part.noBid) continue;
    const partLines = lines.filter((l) => l.partId === part.partId);
    if (partLines.length === 0) continue;
    items.push({
      partId: part.partId,
      partNumber: part.partNumber,
      revision: part.revision,
      description: part.description,
      note: notes[part.partId] ?? part.defaultNote,
      rows: partLines.map((l) => {
        const unit = quoteUnitPrice(l.estimateUnitPrice, l.markup, round);
        return {
          quantity: l.quantity,
          leadTime: l.leadTime,
          unitPrice: unit,
          totalPrice: unit * l.quantity,
        };
      }),
    });
  }
  return { quoteNumber, quoteNote, items };
}

/** Fallback snapshot from the base lines (e.g. /send reached without a saved quote). */
export function buildDefaultSnapshot(quoteNumber: number): QuoteSnapshot {
  return buildSnapshot(buildInitialLines(), {}, DEFAULT_QUOTE_NOTE, quoteNumber, false);
}
