// Canonical DB-row-shaped defaults seeded into part_operations / part_materials
// when a part is first opened in the calculator (see estimateService.hydratePartEstimate).
//
// The operation set is processType-aware (Sheet Metal vs CNC Milling/Turning vs
// generic), and when extracted geometry is available the relevant run-times are
// pre-populated from the geometry formulas and tagged time_source = 'formula'
// (shown amber in the calculator until the estimator confirms them). Rates resolve
// from the org's operation_templates (Kalkulationsvorlagen). No framework imports.

import { db, operationTemplates } from "@uptool/db";
import {
  type SheetMetalGeometry,
  type SolidGeometry,
  mrrForMaterial,
  suggestCncMillingTimes,
  suggestSheetMetalTimes,
} from "@uptool/shared";
import { eq } from "drizzle-orm";

/** Fallback shop rate (€80,00/h) used only when an org has no matching
 *  operation_template for a default operation. */
export const DEFAULT_HOURLY_RATE_CENTS = 8000;

export type TimeSource = "manual" | "formula" | "template";

/** A default operation shaped for a part_operations insert (orgId/partId added by
 *  the service). setup/runtime rate cents resolve from operation_templates; the
 *  0021 override columns are left unset — a freshly seeded default isn't user-touched. */
export interface DefaultOperationRow {
  name: string;
  operationType: string;
  costCategory: "inside" | "outside" | "purchased";
  setupMinutes: string;
  runMinutes: string;
  hourlyRateCents: number;
  setupRateCents: number;
  runtimeRateCents: number;
  isNonRecurring: boolean;
  sortOrder: number;
  timeSource: TimeSource;
}

/** The part's extracted geometry columns relevant to the time formulas (nullable). */
export interface GeometryInput extends SheetMetalGeometry, SolidGeometry {}

/** Which formula (if any) drives an operation's run-time. */
type FormulaTarget = "laser" | "bending" | "cnc" | undefined;

interface BaseOp {
  name: string;
  operationType: string;
  costCategory: "inside" | "outside" | "purchased";
  setupMinutes: string;
  runMinutes: string;
  isNonRecurring: boolean;
  formula?: FormulaTarget;
}

const PROGRAMMING: BaseOp = { name: "Programming", operationType: "programming", costCategory: "inside", setupMinutes: "0", runMinutes: "0", isNonRecurring: true };
const QA: BaseOp = { name: "QA / Inspection", operationType: "inspection", costCategory: "inside", setupMinutes: "15", runMinutes: "3", isNonRecurring: false };
const PACKAGING: BaseOp = { name: "Packaging & Shipping", operationType: "pack-and-ship", costCategory: "inside", setupMinutes: "20", runMinutes: "1", isNonRecurring: false };

/** The default operation set for a part's process type. Run-times on formula ops
 *  start at 0 and are filled from geometry when available (else stay 0 / manual). */
function opSetFor(processType?: string | null): BaseOp[] {
  const pt = processType ?? "";
  if (pt === "Sheet Metal") {
    return [
      { name: "Laser Cutting", operationType: "laser-cutting", costCategory: "inside", setupMinutes: "15", runMinutes: "0", isNonRecurring: false, formula: "laser" },
      { name: "Bending", operationType: "bending", costCategory: "inside", setupMinutes: "20", runMinutes: "0", isNonRecurring: false, formula: "bending" },
      QA,
      PACKAGING,
    ];
  }
  if (pt.startsWith("CNC Milling")) {
    return [
      PROGRAMMING,
      { name: "CNC Milling", operationType: "cnc-milling", costCategory: "inside", setupMinutes: "120", runMinutes: "0", isNonRecurring: false, formula: "cnc" },
      QA,
      PACKAGING,
    ];
  }
  if (pt.startsWith("CNC Turning")) {
    return [
      PROGRAMMING,
      { name: "Turning", operationType: "generic", costCategory: "inside", setupMinutes: "90", runMinutes: "0", isNonRecurring: false, formula: "cnc" },
      QA,
      PACKAGING,
    ];
  }
  return [
    PROGRAMMING,
    { name: "Machining", operationType: "generic", costCategory: "inside", setupMinutes: "0", runMinutes: "0", isNonRecurring: false },
    QA,
    PACKAGING,
  ];
}

/** Round minutes to 2 decimals, as a numeric-column string. */
const min2 = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * Default operation rows for a freshly-hydrated part. The set is chosen by
 * processType; when geometry is provided, formula-target run-times are filled and
 * tagged time_source = 'formula'. Each op's hourly rate resolves from the org's
 * operation_templates (match by name, then operation_type, else €80/h + warning).
 */
export async function buildDefaultOperations(
  orgId: string,
  geometry?: GeometryInput | null,
  processType?: string | null,
): Promise<DefaultOperationRow[]> {
  const templates = await db
    .select({
      name: operationTemplates.name,
      operationType: operationTemplates.operationType,
      rateCents: operationTemplates.defaultHourlyRateCents,
    })
    .from(operationTemplates)
    .where(eq(operationTemplates.orgId, orgId));

  const byName = new Map(templates.map((t) => [t.name, t.rateCents]));
  const byType = new Map(templates.map((t) => [t.operationType, t.rateCents]));

  // Formula times computed once (material category unknown at hydration → default MRR).
  const sheet = geometry ? suggestSheetMetalTimes(geometry) : null;
  const cnc = geometry ? suggestCncMillingTimes(geometry, mrrForMaterial(undefined)) : null;

  return opSetFor(processType).map((op, i) => {
    const matched = byName.get(op.name) ?? byType.get(op.operationType);
    if (matched == null) {
      console.warn(
        `[buildDefaultOperations] no operation_template for "${op.name}" (type ${op.operationType}) in org ${orgId} — falling back to €${DEFAULT_HOURLY_RATE_CENTS / 100}/h`,
      );
    }
    const rate = matched ?? DEFAULT_HOURLY_RATE_CENTS;

    let runMinutes = op.runMinutes;
    let timeSource: TimeSource = "manual";
    if (geometry) {
      if (op.formula === "laser" && sheet) {
        runMinutes = min2(sheet.laserRunMinutes);
        timeSource = "formula";
      } else if (op.formula === "bending" && sheet && (geometry.bendCount ?? 0) > 0) {
        runMinutes = min2(sheet.bendingRunMinutes);
        timeSource = "formula";
      } else if (op.formula === "cnc" && cnc && cnc.runMinutes > 0) {
        runMinutes = min2(cnc.runMinutes);
        timeSource = "formula";
      }
    }

    return {
      name: op.name,
      operationType: op.operationType,
      costCategory: op.costCategory,
      setupMinutes: op.setupMinutes,
      runMinutes,
      hourlyRateCents: rate,
      setupRateCents: rate,
      runtimeRateCents: rate,
      isNonRecurring: op.isNonRecurring,
      sortOrder: i,
      timeSource,
    };
  });
}

/** A default material card shaped for a part_materials insert. */
export interface DefaultMaterialRow {
  materialType: string;
  fields: Record<string, unknown>;
  sortOrder: number;
}

/** Default material card(s) for a freshly-hydrated part — one Sheet card mirroring
 *  the client SHEET_CARD_EXAMPLE, with its type-specific values in `fields`. */
export function buildDefaultMaterials(): DefaultMaterialRow[] {
  return [
    {
      materialType: "sheet",
      fields: {
        material: "AS A36",
        thickness: "0,12",
        costPerWeight: "1,24",
        unfoldedLength: "7,09",
        unfoldedWidth: "5,02",
        blankLength: "7,14",
        blankWidth: "5,07",
        addBlanks: "1",
        roundUp: "exact",
        fullSheetCost: 286.89,
      },
      sortOrder: 0,
    },
  ];
}
