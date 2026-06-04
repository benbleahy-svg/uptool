// Rich estimate unit cost per quantity break — the SAME number the per-part
// calculator displays (computeTotals = Σ computeOperationCost + Σ
// computeMaterialCost over the rich client models). This is the snapshot source
// for a new quote tier (A-Option-3): costPerUnitCents = rich client-computed
// estimate cost at tier-add time — NOT the server's simple computeCostsForPart,
// which ignores op-level markup, manual unit-price overrides, volume discounts
// and per-op rate overrides.
//
// NOTE: already-stored tier rows captured the OLD simple cost; they must be
// deleted + re-added to pick up op-markup/overrides. No server cost engine, no
// migration — this reuses the pure client cost functions (persistence.ts is
// explicitly a shared DB↔client module, server-importable).

import { computeTotals } from "@/lib/quoting/estimateTotals";
import type { PartMaterial, PartOperation } from "@uptool/services";
import { dbMaterialToClient, dbOperationToClient } from "../estimate/[partId]/persistence";

export function richEstimateByQty(
  operations: PartOperation[],
  materials: PartMaterial[],
  quantityBreaks: readonly number[],
): Array<{ quantity: number; costPerUnitCents: number }> {
  const ops = operations.map(dbOperationToClient);
  const mats = materials.map(dbMaterialToClient);
  return quantityBreaks.map((quantity) => ({
    quantity,
    costPerUnitCents: Math.round(computeTotals(mats, ops, quantity).perUnit * 100),
  }));
}
