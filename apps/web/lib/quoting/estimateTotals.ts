// Aggregate totals + price breakdown across Materials and Operations.
// Pure module. Placeholder costs come from materialCost / operationCost.

import { type MaterialCard, computeMaterialCost } from "./materialCost";
import {
  type Operation,
  computeOperationCost,
  operationIsComplete,
  operationTimeMinutes,
} from "./operationCost";

export interface QtyTotals {
  total: number;
  perUnit: number;
}

/** Sum of all material costs + all complete operation costs at a quantity. */
export function computeTotals(
  materials: MaterialCard[],
  operations: Operation[],
  qty: number,
): QtyTotals {
  const materialsTotal = materials.reduce((s, m) => s + computeMaterialCost(m, qty).total, 0);
  const opsTotal = operations
    .filter(operationIsComplete)
    .reduce((s, o) => s + computeOperationCost(o, qty).total, 0);
  const total = materialsTotal + opsTotal;
  return { total, perUnit: qty > 0 ? total / qty : 0 };
}

export type BreakdownKey = "materials" | "nr" | "recurring" | "outside" | "purchased";

export interface BreakdownSegment {
  key: BreakdownKey;
  shortLabel: string;
  fullLabel: string;
  value: number;
}

export interface Breakdown {
  totalTimeHr: number;
  total: number;
  segments: BreakdownSegment[];
}

/** Category labels in fixed order (NR expands to Non-Recurring in the full name). */
export const SEGMENT_META: { key: BreakdownKey; shortLabel: string; fullLabel: string }[] = [
  {
    key: "materials",
    shortLabel: "Materials & Purchased Parts",
    fullLabel: "Materials & Purchased Parts",
  },
  {
    key: "nr",
    shortLabel: "NR Internal Operations",
    fullLabel: "Non-Recurring Internal Operations",
  },
  {
    key: "recurring",
    shortLabel: "Recurring Internal Operations",
    fullLabel: "Recurring Internal Operations",
  },
  { key: "outside", shortLabel: "Outside Services", fullLabel: "Outside Services" },
  { key: "purchased", shortLabel: "Purchased Parts", fullLabel: "Purchased Parts" },
];

/** Build labelled segments from raw per-category values (e.g. an aggregate). */
export function segmentsFromValues(values: Record<BreakdownKey, number>): BreakdownSegment[] {
  return SEGMENT_META.map((m) => ({ ...m, value: values[m.key] }));
}

/** Four-category price breakdown (in fixed order) at a quantity. */
export function computeBreakdown(
  materials: MaterialCard[],
  operations: Operation[],
  qty: number,
): Breakdown {
  const ops = operations.filter(operationIsComplete);
  const sum = (list: Operation[]) =>
    list.reduce((s, o) => s + computeOperationCost(o, qty).total, 0);

  // Disjoint buckets keyed on cost_category so every op lands in exactly one
  // segment (internal ops split by recurrence): inside+NR, inside+recurring,
  // outside, purchased. Sum of segments = materials + all complete ops.
  const isInside = (o: Operation) => o.costCategory === "inside";
  const materialsTotal = materials.reduce((s, m) => s + computeMaterialCost(m, qty).total, 0);
  const nrInternal = sum(ops.filter((o) => isInside(o) && o.nonRecurring));
  const recurringInternal = sum(ops.filter((o) => isInside(o) && !o.nonRecurring));
  const outside = sum(ops.filter((o) => o.costCategory === "outside"));
  const purchased = sum(ops.filter((o) => o.costCategory === "purchased"));
  const totalTimeMin = ops.reduce((s, o) => s + operationTimeMinutes(o, qty), 0);

  return {
    totalTimeHr: totalTimeMin / 60,
    total: materialsTotal + nrInternal + recurringInternal + outside + purchased,
    segments: [
      {
        key: "materials",
        shortLabel: "Materials & Purchased Parts",
        fullLabel: "Materials & Purchased Parts",
        value: materialsTotal,
      },
      {
        key: "nr",
        shortLabel: "NR Internal Operations",
        fullLabel: "Non-Recurring Internal Operations",
        value: nrInternal,
      },
      {
        key: "recurring",
        shortLabel: "Recurring Internal Operations",
        fullLabel: "Recurring Internal Operations",
        value: recurringInternal,
      },
      {
        key: "outside",
        shortLabel: "Outside Services",
        fullLabel: "Outside Services",
        value: outside,
      },
      {
        key: "purchased",
        shortLabel: "Purchased Parts",
        fullLabel: "Purchased Parts",
        value: purchased,
      },
    ],
  };
}
