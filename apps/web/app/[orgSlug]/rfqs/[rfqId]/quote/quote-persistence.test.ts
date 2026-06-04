import type { PartOperation } from "@uptool/services";
import { describe, expect, test } from "vitest";
import { richEstimateByQty } from "./estimate-cost";
import {
  type QuoteLine,
  type QuoteLineRow,
  computeQuoteUnitCents,
  reconcileAddedLine,
  revertLineFields,
} from "./quote-state";

// Minimal PartOperation row builder (DB select shape).
function op(over: Partial<PartOperation>): PartOperation {
  return {
    id: "op-1",
    orgId: "org-1",
    partId: "part-1",
    name: "CNC Milling",
    operationType: "cnc-milling",
    setupMinutes: "30",
    runMinutes: "5",
    hourlyRateCents: 8000,
    isNonRecurring: false,
    sortOrder: 0,
    unitPriceOverrideCents: null,
    markupPct: null,
    setupRateCents: null,
    runtimeRateCents: null,
    volumeDiscountTiers: null,
    userTouched: true,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    ...over,
  };
}

function line(over: Partial<QuoteLine>): QuoteLine {
  return {
    id: "l1",
    partId: "p1",
    quantity: 1,
    costPerUnitCents: 10000,
    markup: "",
    leadTimeWeeks: null,
    tierLabel: null,
    quoteUnitPriceCents: 10000,
    quoteTotalCents: 10000,
    sortOrder: 0,
    ...over,
  };
}

describe("A — snapshot cost = rich estimate (op-markup + override), not simple", () => {
  test("rich cost includes op markup + unit-price override", () => {
    // CNC op: setup 30 / run 5, op markup 20%, unit-price override €100,00.
    const o = op({ markupPct: "20", unitPriceOverrideCents: 10_000 });
    const costPerUnitCents = richEstimateByQty([o], [], [1])[0]?.costPerUnitCents;

    // Rich (computeOperationCost): override €100 → ×1.20 markup = €120,00 = 12000¢.
    expect(costPerUnitCents).toBe(12_000);
    // The SIMPLE computeCostsForPart would return 4667¢ (€46,67):
    //   round(30/60×8000)=4000 + round(5/60×8000)=667 → ignores override AND markup.
    // The snapshot must be the rich value, not the simple one.
    expect(costPerUnitCents).not.toBe(4_667);
  });

  test("with no markup/override, rich == the plain time cost", () => {
    const o = op({}); // setup 30 / run 5 @ €80/h, no markup/override
    const costPerUnitCents = richEstimateByQty([o], [], [1])[0]?.costPerUnitCents;
    // round(30/60×8000)=4000 + round(5/60×8000)=667 = 4667
    expect(costPerUnitCents).toBe(4_667);
  });
});

describe("F — field-scoped revert", () => {
  test("reverting markup keeps a separately-edited quantity", () => {
    // current: markup 50% + qty 20 (qty was edited+committed separately).
    const current = line({ markup: "50", quantity: 20, costPerUnitCents: 10_000 });
    // before: the pre-markup snapshot (markup 30, qty was still 10 then).
    const before = line({ markup: "30", quantity: 10, costPerUnitCents: 10_000 });

    const reverted = revertLineFields(current, before, ["markup"]);

    expect(reverted.markup).toBe("30"); // markup restored
    expect(reverted.quantity).toBe(20); // sibling NOT clobbered
    // re-priced from restored markup: round(10000×1.30)=13000, ×20 = 260000
    expect(reverted.quoteUnitPriceCents).toBe(computeQuoteUnitCents(10_000, "30"));
    expect(reverted.quoteUnitPriceCents).toBe(13_000);
    expect(reverted.quoteTotalCents).toBe(260_000);
  });

  test("reverting a non-price field does not re-price", () => {
    const current = line({ tierLabel: "B", markup: "10", quoteUnitPriceCents: 11_000, quoteTotalCents: 11_000 });
    const before = line({ tierLabel: "A", markup: "10" });
    const reverted = revertLineFields(current, before, ["tierLabel"]);
    expect(reverted.tierLabel).toBe("A");
    expect(reverted.markup).toBe("10");
    expect(reverted.quoteUnitPriceCents).toBe(11_000); // untouched
  });
});

describe("D4 — orphan reconcile on add", () => {
  const row: QuoteLineRow = {
    id: "real-1",
    partId: "p1",
    quantity: 1,
    costPerUnitCents: 5000,
    markupPct: "0",
    leadTimeWeeks: null,
    tierLabel: null,
    quoteUnitPriceCents: 5000,
    quoteTotalCents: 5000,
    sortOrder: 0,
  };

  test("temp row present → swap to real, no orphan", () => {
    const lines = [line({ id: "tmp-1" })];
    const { lines: next, orphanId } = reconcileAddedLine(lines, "tmp-1", row);
    expect(orphanId).toBeNull();
    expect(next.map((l) => l.id)).toEqual(["real-1"]);
  });

  test("temp row gone (deleted mid-flight) → report orphan to delete", () => {
    const { lines: next, orphanId } = reconcileAddedLine([], "tmp-1", row);
    expect(orphanId).toBe("real-1");
    expect(next).toEqual([]); // nothing re-inserted
  });
});
