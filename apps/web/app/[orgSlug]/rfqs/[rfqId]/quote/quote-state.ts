// Client-side quote state: lines, groups, and the price math. No DB persistence.

import { getCostShares } from "@/lib/quoting/estimateResults";
import type { BreakdownKey } from "@/lib/quoting/estimateTotals";
import { parseDecimal } from "@/lib/quoting/materialCost";
import { QUOTE_PARTS } from "./quote-data";

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
