import { type Operation, computeOperationCost, createOperation } from "@/lib/quoting/operationCost";
import { describe, expect, test } from "vitest";
import { opPatchToSaves, revertOpField } from "./persistence";

function op(
  type: Parameters<typeof createOperation>[0],
  fields: Record<string, string>,
): Operation {
  return { id: "op-1", ...createOperation(type), fields };
}

// ─── B: money math (the part that must be exact) ──────────────────────────────
describe("computeOperationCost — money", () => {
  // setup 30min, run 5min, €80/h (default rates), qty 10.
  // setup once + run×qty: (30/60)*80 + ((5*10)/60)*80 = 40 + 66.6667 = 106.6667
  test("setup-once + run×qty at €80/h, qty 10", () => {
    const cnc = op("cnc-milling", { setupTime: "30", runTime: "5" });
    const c = computeOperationCost(cnc, 10);
    expect(c.rawTotal).toBeCloseTo(106.6667, 3);
    expect(c.rawPerUnit).toBeCloseTo(10.6667, 3);
    expect(c.total).toBeCloseTo(106.6667, 3); // no discount/markup
    // qty 1 and 100 scale run, not setup
    expect(computeOperationCost(cnc, 1).rawTotal).toBeCloseTo(46.6667, 3);
    expect(computeOperationCost(cnc, 100).rawTotal).toBeCloseTo(706.6667, 3);
  });

  // 10% off at qty ≥ 10 → per-unit 10.6667 × 0.9 = 9.6 → total 96 at qty 10.
  test("volume-discount tier discounts per-unit at the crossed threshold", () => {
    const cnc = op("cnc-milling", { setupTime: "30", runTime: "5" });
    cnc.volumeDiscount = true;
    cnc.volumeTiers = [{ qty: "10", discountPct: "10" }];
    const at10 = computeOperationCost(cnc, 10);
    expect(at10.discountPct).toBe(10);
    expect(at10.perUnit).toBeCloseTo(9.6, 4);
    expect(at10.total).toBeCloseTo(96, 4);
    // below the threshold: no discount
    const at1 = computeOperationCost(cnc, 1);
    expect(at1.discountPct).toBe(0);
    expect(at1.total).toBeCloseTo(46.6667, 3);
  });

  // E1 single per-unit override: displayed Total per column = override × qty.
  test("unitPriceOverride is per-unit; Total = override × qty across columns", () => {
    const cnc = op("cnc-milling", { setupTime: "30", runTime: "5" });
    cnc.unitPriceOverride = "12";
    expect(computeOperationCost(cnc, 1).rawTotal).toBeCloseTo(12, 4);
    expect(computeOperationCost(cnc, 10).rawTotal).toBeCloseTo(120, 4);
    expect(computeOperationCost(cnc, 100).rawTotal).toBeCloseTo(1200, 4);
    expect(computeOperationCost(cnc, 10).overridden).toBe(true);
  });

  // Op-level markup applies once (after cost); no second application anywhere.
  test("operation markup applies after cost, once", () => {
    const cnc = op("cnc-milling", { setupTime: "30", runTime: "5" });
    cnc.markupPct = "10";
    const c = computeOperationCost(cnc, 10);
    expect(c.rawTotal).toBeCloseTo(106.6667, 3); // raw unchanged
    expect(c.total).toBeCloseTo(117.3333, 3); // ×1.10 once
  });
});

// ─── opPatchToSaves: client patch → DB field saves ────────────────────────────
describe("opPatchToSaves", () => {
  const base = op("cnc-milling", { setupTime: "120", runTime: "60" });

  test("setup time change → one setupMinutes save", () => {
    const saves = opPatchToSaves(base, { fields: { setupTime: "30", runTime: "60" } });
    expect(saves).toEqual([{ key: "setupMinutes", kind: "update", patch: { setupMinutes: 30 } }]);
  });

  test("markup → markupPct save", () => {
    expect(opPatchToSaves(base, { markupPct: "10" })).toEqual([
      { key: "markupPct", kind: "update", patch: { markupPct: 10 } },
    ]);
  });

  test("empty override → clearOverride; value → cents", () => {
    expect(opPatchToSaves(base, { unitPriceOverride: "" })).toEqual([
      { key: "unitPriceOverrideCents", kind: "clearOverride" },
    ]);
    expect(opPatchToSaves(base, { unitPriceOverride: "50" })).toEqual([
      { key: "unitPriceOverrideCents", kind: "update", patch: { unitPriceOverrideCents: 5000 } },
    ]);
  });

  test("rate cleared → null cents; UI-only fields → no save", () => {
    expect(opPatchToSaves(base, { setupRate: "" })).toEqual([
      { key: "setupRateCents", kind: "update", patch: { setupRateCents: null } },
    ]);
    expect(opPatchToSaves(base, { collapsed: true })).toEqual([]);
    expect(opPatchToSaves(base, { setupRateId: "default" })).toEqual([]);
  });
});

// ─── F: field-scoped revert must NOT clobber sibling fields ────────────────────
describe("revertOpField", () => {
  test("reverting setupMinutes leaves a separately-edited markup intact", () => {
    const snapshot = op("cnc-milling", { setupTime: "100", runTime: "50" }); // markupPct "0"
    const current: Operation = {
      ...op("cnc-milling", { setupTime: "200", runTime: "50" }),
      markupPct: "5", // edited + committed by a different save
    };
    const reverted = revertOpField(current, snapshot, "setupMinutes");
    expect(reverted.fields.setupTime).toBe("100"); // setup reverted
    expect(reverted.markupPct).toBe("5"); // sibling KEPT (not clobbered to "0")
    expect(reverted.fields.runTime).toBe("50");
  });

  test("reverting markupPct leaves setup intact", () => {
    const snapshot = { ...op("cnc-milling", { setupTime: "200", runTime: "50" }), markupPct: "0" };
    const current = { ...op("cnc-milling", { setupTime: "200", runTime: "50" }), markupPct: "5" };
    const reverted = revertOpField(current, snapshot, "markupPct");
    expect(reverted.markupPct).toBe("0");
    expect(reverted.fields.setupTime).toBe("200");
  });

  test("programming reverts the 'time' field, not setupTime", () => {
    const snapshot = op("programming", { time: "10" });
    const current = op("programming", { time: "99" });
    expect(revertOpField(current, snapshot, "setupMinutes").fields.time).toBe("10");
  });
});
