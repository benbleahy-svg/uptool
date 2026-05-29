// Estimate-stage inputs per part (materials + operations), so the quote can
// derive each line's four-category cost split via the SAME estimate computation
// (computeBreakdown) rather than inventing it at the quote level. Distinct per
// part so the aggregate breakdown varies with the selection.

import { type BreakdownKey, computeBreakdown } from "./estimateTotals";
import { type MaterialCard, SHEET_CARD_EXAMPLE } from "./materialCost";
import { type Operation, type OperationType, createOperation } from "./operationCost";

interface EstimateInputs {
  materials: MaterialCard[];
  operations: Operation[];
}

function mat(fullSheetCost: number): MaterialCard {
  return { id: "m", ...SHEET_CARD_EXAMPLE, fullSheetCost };
}

function op(type: OperationType, fields: Record<string, string>): Operation {
  const base = createOperation(type);
  return { id: type, ...base, fields: { ...base.fields, ...fields } };
}

const laser = (setupTime: string, cycleTime: string) =>
  op("laser-cutting", {
    material: "AS A36",
    thickness: "0,12",
    cutSpeed: "300",
    pierceTime: "1",
    cutLength: "55,09",
    pierces: "43",
    setupTime,
    cycleTime,
    laserType: "fiber",
  });

const finishing = (minBatch: string, cost: string, partArea: string) =>
  op("finishing", { finishingProcess: "anodize", minBatch, cost, partArea });

// All four categories non-zero per part: materials (sheet), NR (programming),
// recurring (deburr / laser / cnc), outside (finishing).
// Tuned so recurring internal operations dominate, with small NR and outside
// shares (matching the quote breakdown bar in screenshot 17.7).
const P1: EstimateInputs = {
  materials: [mat(700)],
  operations: [
    op("programming", { time: "8" }),
    op("deburr", { setupTime: "10", runTime: "1,5" }),
    op("cnc-milling", { setupTime: "12", runTime: "1" }),
    finishing("50", "0,01", "55,45"),
  ],
};

const PART_INPUTS: Record<string, EstimateInputs> = {
  p1: P1,
  p2: {
    materials: [mat(400)],
    operations: [
      op("programming", { time: "6" }),
      laser("8", "0,9"),
      op("deburr", { setupTime: "8", runTime: "1,2" }),
      finishing("40", "0,01", "24,15"),
    ],
  },
  p3: {
    materials: [mat(900)],
    operations: [
      op("programming", { time: "10" }),
      op("deburr", { setupTime: "12", runTime: "2" }),
      op("cnc-milling", { setupTime: "15", runTime: "1,5" }),
      finishing("60", "0,02", "194,65"),
    ],
  },
};

export type CostShares = Record<BreakdownKey, number>;

/**
 * Fractional cost split (sums to 1) for a part at a quantity, from the estimate
 * computation. Multiply by a line's estimate total to get its absolute split.
 */
export function getCostShares(partId: string, qty: number): CostShares {
  const inputs = PART_INPUTS[partId] ?? P1;
  const { total, segments } = computeBreakdown(inputs.materials, inputs.operations, qty);
  const shares = { materials: 0, nr: 0, recurring: 0, outside: 0 } as CostShares;
  for (const seg of segments) {
    shares[seg.key] = total > 0 ? seg.value / total : 0;
  }
  return shares;
}
