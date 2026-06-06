import {
  mrrForMaterial,
  suggestCncMillingTimes,
  suggestSheetMetalTimes,
} from "@uptool/shared";
import { describe, expect, test } from "vitest";

describe("suggestSheetMetalTimes", () => {
  test("known DXF geometry → laser + bending times (defaults)", () => {
    // cutLength 6000 mm @ 6000 mm/min = 1 min; 10 pierces × 3s = 30s = 0.5 min → 1.5
    // 4 bends × 90s = 360s = 6 min
    const r = suggestSheetMetalTimes({ cutLengthMm: 6000, pierceCount: 10, bendCount: 4 });
    expect(r.laserRunMinutes).toBeCloseTo(1.5, 6);
    expect(r.bendingRunMinutes).toBeCloseTo(6, 6);
  });

  test("respects overridden params", () => {
    const r = suggestSheetMetalTimes(
      { cutLengthMm: 3000, pierceCount: 2, bendCount: 1 },
      { cuttingSpeedMmPerMin: 3000, pierceTimeSec: 6, bendTimeSec: 60 },
    );
    // 3000/3000 = 1 min + 2×6/60 = 0.2 → 1.2 ; bending 1×60/60 = 1
    expect(r.laserRunMinutes).toBeCloseTo(1.2, 6);
    expect(r.bendingRunMinutes).toBeCloseTo(1, 6);
  });

  test("zero / null geometry → 0, no crash", () => {
    expect(suggestSheetMetalTimes({ cutLengthMm: null, pierceCount: null, bendCount: null })).toEqual({
      laserRunMinutes: 0,
      bendingRunMinutes: 0,
    });
    expect(suggestSheetMetalTimes({ cutLengthMm: 0, pierceCount: 0, bendCount: 0 })).toEqual({
      laserRunMinutes: 0,
      bendingRunMinutes: 0,
    });
  });
});

describe("suggestCncMillingTimes", () => {
  test("known STEP geometry → run time + removal ratio (steel MRR)", () => {
    // 100×100×100 = 1,000,000 stock; part 600,000; removal 400,000; MRR 15000
    const r = suggestCncMillingTimes(
      { bboxXMm: 100, bboxYMm: 100, bboxZMm: 100, volumeMm3: 600000 },
      mrrForMaterial("steel"),
    );
    expect(r.runMinutes).toBeCloseTo(400000 / 15000, 4); // ≈ 26.667
    expect(r.removalRatioPct).toBeCloseTo(40, 6);
  });

  test("real D1227434 geometry (heavy machining)", () => {
    const stock = 526 * 14 * 947;
    const r = suggestCncMillingTimes(
      { bboxXMm: 526, bboxYMm: 14, bboxZMm: 947, volumeMm3: 747768.73 },
      mrrForMaterial("steel"),
    );
    const removal = stock - 747768.73;
    expect(r.runMinutes).toBeCloseTo(removal / 15000, 2);
    expect(r.removalRatioPct).toBeGreaterThan(80); // heavy machining signal
  });

  test("part volume ≥ stock → removal clamped to 0", () => {
    const r = suggestCncMillingTimes(
      { bboxXMm: 10, bboxYMm: 10, bboxZMm: 10, volumeMm3: 5000 },
      15000,
    );
    expect(r.runMinutes).toBe(0);
    expect(r.removalRatioPct).toBe(0);
  });

  test("zero geometry / zero MRR → 0, no crash", () => {
    expect(
      suggestCncMillingTimes({ bboxXMm: null, bboxYMm: null, bboxZMm: null, volumeMm3: null }, 15000),
    ).toEqual({ runMinutes: 0, removalRatioPct: 0 });
    expect(
      suggestCncMillingTimes({ bboxXMm: 100, bboxYMm: 100, bboxZMm: 100, volumeMm3: 0 }, 0),
    ).toEqual({ runMinutes: 0, removalRatioPct: 0 });
  });
});

describe("mrrForMaterial", () => {
  test("maps categories, defaults unknown/null to other", () => {
    expect(mrrForMaterial("aluminium")).toBe(50000);
    expect(mrrForMaterial("steel")).toBe(15000);
    expect(mrrForMaterial("stainless")).toBe(8000);
    expect(mrrForMaterial("titanium")).toBe(15000); // not in MRR map → other
    expect(mrrForMaterial(null)).toBe(15000);
    expect(mrrForMaterial(undefined)).toBe(15000);
  });
});
