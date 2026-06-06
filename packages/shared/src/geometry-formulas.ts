// Pure geometry → operation-time formulas. No DB / no framework. Fed by the
// extracted geometry columns to pre-populate "suggested" operation run-times that
// the estimator can confirm or override. Parameters default to DACH-baseline values
// and become configurable in Kalkulationsvorlagen later.

/** DXF-derived inputs for sheet-metal time suggestions. */
export interface SheetMetalGeometry {
  cutLengthMm: number | null;
  pierceCount: number | null;
  bendCount: number | null;
}

/** STEP-derived inputs for CNC time suggestions. */
export interface SolidGeometry {
  bboxXMm: number | null;
  bboxYMm: number | null;
  bboxZMm: number | null;
  volumeMm3: number | null;
}

/** Sheet-metal cutting/bending parameters. materialThicknessMm is accepted for a
 *  future speed model; the baseline formula below doesn't use it yet. */
export interface SheetMetalParams {
  materialThicknessMm?: number;
  cuttingSpeedMmPerMin?: number;
  pierceTimeSec?: number;
  bendTimeSec?: number;
}

export const SHEET_METAL_DEFAULTS = {
  cuttingSpeedMmPerMin: 6000, // 3mm S235 baseline
  pierceTimeSec: 3,
  bendTimeSec: 90,
} as const;

/** Material-removal rate (mm³/min) per material category. */
export const CNC_MRR_BY_CATEGORY: Record<string, number> = {
  aluminium: 50000,
  steel: 15000,
  stainless: 8000,
  other: 15000,
};

/** Resolve an org_materials category to an MRR, defaulting to steel/other. */
export function mrrForMaterial(category?: string | null): number {
  if (category && category in CNC_MRR_BY_CATEGORY) {
    return CNC_MRR_BY_CATEGORY[category] as number;
  }
  return CNC_MRR_BY_CATEGORY.other as number;
}

export interface SheetMetalTimes {
  laserRunMinutes: number;
  bendingRunMinutes: number;
}

/**
 * Suggested laser-cutting + bending run-times (minutes) for a sheet-metal part.
 *   laserRunMinutes  = cutLength / cuttingSpeed + pierceCount × pierceTime/60
 *   bendingRunMinutes = bendCount × bendTime/60
 * Missing/zero geometry yields 0 (no crash).
 */
export function suggestSheetMetalTimes(
  geometry: SheetMetalGeometry,
  params: SheetMetalParams = {},
): SheetMetalTimes {
  const speed = params.cuttingSpeedMmPerMin ?? SHEET_METAL_DEFAULTS.cuttingSpeedMmPerMin;
  const pierceTime = params.pierceTimeSec ?? SHEET_METAL_DEFAULTS.pierceTimeSec;
  const bendTime = params.bendTimeSec ?? SHEET_METAL_DEFAULTS.bendTimeSec;

  const cutLen = geometry.cutLengthMm ?? 0;
  const pierces = geometry.pierceCount ?? 0;
  const bends = geometry.bendCount ?? 0;

  const laserRunMinutes = speed > 0 ? cutLen / speed + (pierces * pierceTime) / 60 : 0;
  const bendingRunMinutes = bends * (bendTime / 60);

  return { laserRunMinutes, bendingRunMinutes };
}

export interface CncMillingTimes {
  runMinutes: number;
  removalRatioPct: number;
}

/**
 * Suggested CNC machining run-time (minutes) from a volume-removal estimate.
 *   stockVolume   = bboxX × bboxY × bboxZ
 *   removalVolume = max(0, stockVolume − partVolume)
 *   runMinutes    = removalVolume / MRR
 *   removalRatioPct = removalVolume / stockVolume × 100  (>80% ≈ heavy machining)
 * Degenerate geometry (zero/negative stock or MRR) yields 0 (no crash).
 */
export function suggestCncMillingTimes(
  geometry: SolidGeometry,
  materialMrr: number,
): CncMillingTimes {
  const stockVolume = (geometry.bboxXMm ?? 0) * (geometry.bboxYMm ?? 0) * (geometry.bboxZMm ?? 0);
  if (stockVolume <= 0 || materialMrr <= 0) {
    return { runMinutes: 0, removalRatioPct: 0 };
  }
  const removalVolume = Math.max(0, stockVolume - (geometry.volumeMm3 ?? 0));
  return {
    runMinutes: removalVolume / materialMrr,
    removalRatioPct: (removalVolume / stockVolume) * 100,
  };
}
