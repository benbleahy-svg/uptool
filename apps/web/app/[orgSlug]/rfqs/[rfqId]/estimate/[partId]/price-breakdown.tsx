"use client";

import { computeBreakdown } from "@/lib/quoting/estimateTotals";
import type { MaterialCard } from "@/lib/quoting/materialCost";
import type { Operation } from "@/lib/quoting/operationCost";
import { BreakdownBar } from "../../_components/breakdown-bar";

export function PriceBreakdown({
  materials,
  operations,
  qty,
}: {
  materials: MaterialCard[];
  operations: Operation[];
  qty: number;
}) {
  const { totalTimeHr, segments } = computeBreakdown(materials, operations, qty);
  return <BreakdownBar segments={segments} totalTimeHr={totalTimeHr} />;
}
