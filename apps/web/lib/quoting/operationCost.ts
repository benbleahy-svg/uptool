// Operation cost calculation + catalogue for the estimate calculator.
// Pure module (no React) so it can be unit-tested and reused.
//
// Time-based ops (Programming / CNC Milling / QA-Inspection / Packaging &
// Shipping / Deburr / Bending / generic) use the real engine below:
//   total time per qty = setupMin + runMin × qty   (setup once, run per unit)
//   cost = setupHr × SetupRate + (runHr × qty) × RuntimeRate  (separate €/h rates)
//   → volume discount (per-unit, highest crossed tier) → op-level markup
// Laser Cutting / Finishing keep their existing placeholder formulae (no rate
// panel / discount / markup) until their real models land. See ADR 0017.

import { getHourlyRate } from "@/app/[orgSlug]/settings/calculator-templates/rates";
import { type MaterialCard, materialIsComplete } from "./materialCost";

export type OperationType =
  | "programming"
  | "laser-cutting"
  | "deburr"
  | "bending"
  | "finishing"
  | "inspection"
  | "cnc-milling"
  | "pack-and-ship"
  | "generic";

export type OpFieldKind = "number" | "text" | "dropdown";

export interface OpFieldDef {
  key: string;
  label: string;
  kind: OpFieldKind;
  unit?: string;
  prefix?: string;
  required?: boolean;
  readOnly?: boolean;
  clearable?: boolean;
  align?: "left" | "right";
  width?: string;
  options?: ReadonlyArray<{ id: string; label: string }>;
}

export interface OpTypeDef {
  type: OperationType;
  name: string;
  fields: OpFieldDef[];
  nonRecurring: boolean;
  outside: boolean;
}

/** A volume-discount tier: at qty ≥ `qty`, knock `discountPct`% off per-unit cost. */
export interface VolumeTier {
  /** Threshold quantity (entered as a string so the inline editor edits cleanly). */
  qty: string;
  /** Discount percent (string for the same reason). */
  discountPct: string;
}

/** Default tiers seeded when Volume Discount is first enabled (user-editable). */
export const DEFAULT_VOLUME_TIERS: VolumeTier[] = [
  { qty: "1", discountPct: "0" },
  { qty: "10", discountPct: "5" },
  { qty: "100", discountPct: "10" },
  { qty: "1000", discountPct: "15" },
];

export interface Operation {
  id: string;
  type: OperationType;
  name: string;
  collapsed: boolean;
  fields: Record<string, string>;
  nonRecurring: boolean;
  outside: boolean;
  /** Hourly-rate ids (from the calculator-templates rates source). */
  setupRateId: string;
  runtimeRateId: string;
  /** Per-operation €/h overrides of the selected rate. Empty = use the configured
   *  default; clearing reverts to it. */
  setupRate: string;
  runtimeRate: string;
  /** Whether the volume-discount tier table is active. */
  volumeDiscount: boolean;
  /** Editable discount tiers (persisted per operation). */
  volumeTiers: VolumeTier[];
  /** Operation-level internal markup %, applied after cost. Separate from the
   *  quote-page customer markup — never double-counted. */
  markupPct: string;
  /** Free-text note (revealed by the "+ Note" button). */
  note: string;
  /** Manual per-UNIT price override (euros, comma-tolerant). Empty = use the
   *  calculated price. ONE value per operation, applied across every quantity
   *  column (displayed Total = override × qty), rendered blue. Persisted as
   *  part_operations.unit_price_override_cents. Per-qty independence returns with
   *  the fields-jsonb epic (see ADR 0020). */
  unitPriceOverride: string;
}

/** Setup/run field keys for time-based ops; `null` marks a legacy (non-time) op. */
const TIME_MODEL: Record<OperationType, { setupKey?: string; runKey?: string } | null> = {
  programming: { setupKey: "time" },
  "cnc-milling": { setupKey: "setupTime", runKey: "runTime" },
  inspection: { setupKey: "setupTime", runKey: "runTime" },
  "pack-and-ship": { setupKey: "setupTime", runKey: "runTime" },
  deburr: { setupKey: "setupTime", runKey: "runTime" },
  bending: { setupKey: "setupTime", runKey: "runTime" },
  generic: { setupKey: "setupTime", runKey: "runTime" },
  "laser-cutting": null,
  finishing: null,
};

/** Time-based ops use the inline-input + rate-panel model; legacy ops do not. */
export function isTimeBased(type: OperationType): boolean {
  return TIME_MODEL[type] !== null;
}

/** Which time inputs a time-based op exposes (drives the rate panel + inline inputs). */
export function opTimeKind(type: OperationType): { hasSetup: boolean; hasRun: boolean } {
  const m = TIME_MODEL[type];
  return { hasSetup: !!m?.setupKey, hasRun: !!m?.runKey };
}

const setupTime: OpFieldDef = {
  key: "setupTime",
  label: "Setup Time",
  kind: "number",
  unit: "min",
  required: true,
  align: "right",
  width: "w-28",
};
const runTime: OpFieldDef = {
  key: "runTime",
  label: "Run Time",
  kind: "number",
  unit: "min",
  required: true,
  align: "right",
  width: "w-28",
};

export const LASER_TYPES = [
  { id: "fiber", label: "Fiber" },
  { id: "co2", label: "CO₂" },
] as const;

export const FINISHING_PROCESSES = [
  { id: "anodize", label: "Anodize" },
  { id: "powder-coat", label: "Powder Coat" },
  { id: "black-oxide", label: "Black Oxide" },
  { id: "passivate", label: "Passivate" },
  { id: "chromate", label: "Chromate" },
  { id: "zinc-plate", label: "Zinc Plate" },
  { id: "paint", label: "Paint" },
] as const;

export const OPERATION_CATALOGUE: Record<OperationType, OpTypeDef> = {
  programming: {
    type: "programming",
    name: "Programming",
    nonRecurring: true,
    outside: false,
    fields: [
      {
        key: "time",
        label: "Time",
        kind: "number",
        unit: "min",
        required: true,
        align: "right",
        width: "w-28",
      },
    ],
  },
  "laser-cutting": {
    type: "laser-cutting",
    name: "Laser Cutting",
    nonRecurring: false,
    outside: false,
    fields: [
      {
        key: "material",
        label: "Material",
        kind: "text",
        required: true,
        clearable: true,
        width: "w-40",
      },
      {
        key: "thickness",
        label: "Thickness",
        kind: "number",
        unit: "cm",
        required: true,
        align: "right",
        width: "w-24",
      },
      {
        key: "cutSpeed",
        label: "Cut speed",
        kind: "number",
        unit: "cm/min",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "pierceTime",
        label: "Pierce time",
        kind: "number",
        unit: "sec",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "cutLength",
        label: "Cut length",
        kind: "number",
        unit: "cm",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "pierces",
        label: "Pierces",
        kind: "number",
        required: true,
        align: "right",
        width: "w-24",
      },
      {
        key: "setupTime",
        label: "Setup time",
        kind: "number",
        unit: "min",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "cycleTime",
        label: "Cycle time",
        kind: "number",
        unit: "min",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "laserType",
        label: "Laser Type",
        kind: "dropdown",
        required: true,
        width: "w-28",
        options: LASER_TYPES,
      },
    ],
  },
  deburr: {
    type: "deburr",
    name: "Deburr",
    nonRecurring: false,
    outside: false,
    fields: [setupTime, runTime],
  },
  bending: {
    type: "bending",
    name: "Bending",
    nonRecurring: false,
    outside: false,
    fields: [setupTime, runTime],
  },
  finishing: {
    type: "finishing",
    name: "Finishing (new)",
    nonRecurring: false,
    outside: true,
    fields: [
      {
        key: "finishingProcess",
        label: "Finishing Process",
        kind: "dropdown",
        required: true,
        clearable: true,
        width: "w-40",
        options: FINISHING_PROCESSES,
      },
      {
        key: "minBatch",
        label: "Min. Batch",
        kind: "number",
        unit: "€",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "cost",
        label: "Cost",
        kind: "number",
        unit: "€/cm²",
        required: true,
        align: "right",
        width: "w-28",
      },
      {
        key: "partArea",
        label: "Part Area",
        kind: "number",
        unit: "cm²",
        readOnly: true,
        align: "right",
        width: "w-28",
      },
    ],
  },
  inspection: {
    type: "inspection",
    name: "QA / Inspection",
    nonRecurring: false,
    outside: false,
    fields: [setupTime, runTime],
  },
  "cnc-milling": {
    type: "cnc-milling",
    name: "CNC Milling",
    nonRecurring: false,
    outside: false,
    fields: [setupTime, runTime],
  },
  "pack-and-ship": {
    type: "pack-and-ship",
    name: "Packaging & Shipping",
    nonRecurring: false,
    outside: false,
    fields: [setupTime, runTime],
  },
  generic: {
    type: "generic",
    name: "Operation",
    nonRecurring: false,
    outside: false,
    fields: [setupTime, runTime],
  },
};

// Comma-tolerant so German "0,9" parses (fields may hold a de-DE decimal).
function num(value: string | undefined): number {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Build a new operation (no id) with default field values. */
export function createOperation(
  type: OperationType,
  opts?: { name?: string; partArea?: number },
): Omit<Operation, "id"> {
  const def = OPERATION_CATALOGUE[type];
  const fields: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.key === "partArea" && opts?.partArea != null) {
      fields[f.key] = opts.partArea.toLocaleString("de-DE", { maximumFractionDigits: 2 });
    } else if (f.kind === "dropdown") {
      fields[f.key] = f.clearable ? "" : (f.options?.[0]?.id ?? "");
    } else {
      fields[f.key] = "";
    }
  }
  return {
    type,
    name: opts?.name ?? def.name,
    collapsed: false,
    fields,
    nonRecurring: def.nonRecurring,
    outside: def.outside,
    setupRateId: "default",
    runtimeRateId: "default",
    setupRate: "",
    runtimeRate: "",
    volumeDiscount: false,
    volumeTiers: DEFAULT_VOLUME_TIERS.map((t) => ({ ...t })),
    markupPct: "0",
    note: "",
    unitPriceOverride: "",
  };
}

/** Map setup/run minutes from an operation's fields. */
function timeFor(op: Operation): { setupMin: number; runMin: number } {
  const model = TIME_MODEL[op.type];
  if (model) {
    return {
      setupMin: model.setupKey ? num(op.fields[model.setupKey]) : 0,
      runMin: model.runKey ? num(op.fields[model.runKey]) : 0,
    };
  }
  // Legacy ops: laser maps cycle time to run; others default to setup/run keys.
  if (op.type === "laser-cutting") {
    return { setupMin: num(op.fields.setupTime), runMin: num(op.fields.cycleTime) };
  }
  return { setupMin: num(op.fields.setupTime), runMin: num(op.fields.runTime) };
}

/** Volume-discount % applied at a quantity: the highest tier threshold qty meets. */
export function volumeDiscountPct(op: Operation, qty: number): number {
  if (!op.volumeDiscount) return 0;
  let pct = 0;
  for (const tier of op.volumeTiers) {
    if (qty >= num(tier.qty)) pct = Math.max(pct, num(tier.discountPct));
  }
  return pct;
}

/** Operation-level internal markup as a fraction (e.g. 10% → 0.1). */
function markupFraction(op: Operation): number {
  return num(op.markupPct) / 100;
}

/** Effective €/h: the per-operation override if set, else the configured default. */
export function effectiveRate(rateId: string, override: string): number {
  return override.trim() !== "" ? num(override) : getHourlyRate(rateId).eurPerHour;
}

/** Raw (pre-discount, pre-markup) PER-UNIT cost from the time/legacy formula. */
function computedRawPerUnit(op: Operation, qty: number): number {
  if (!isTimeBased(op.type)) {
    if (op.type === "finishing") {
      const total = Math.max(
        num(op.fields.minBatch),
        num(op.fields.cost) * num(op.fields.partArea) * qty,
      );
      return qty > 0 ? total / qty : 0;
    }
    const { setupMin, runMin } = timeFor(op);
    return ((qty > 0 ? setupMin / qty : 0) + runMin) * (getHourlyRate("default").eurPerHour / 60);
  }
  const { setupMin, runMin } = timeFor(op);
  const setupRate = effectiveRate(op.setupRateId, op.setupRate);
  const runtimeRate = effectiveRate(op.runtimeRateId, op.runtimeRate);
  const rawTotal = (setupMin / 60) * setupRate + ((runMin * qty) / 60) * runtimeRate;
  return qty > 0 ? rawTotal / qty : 0;
}

export interface OperationCost {
  /** Final cost (discount + markup applied) — feeds collapsed cells + part totals. */
  total: number;
  perUnit: number;
  /** Pre-discount, pre-markup cost (the editable grid cells). */
  rawTotal: number;
  rawPerUnit: number;
  /** Discount % applied at this quantity (0 when disabled / no tier met). */
  discountPct: number;
  /** True when this operation's price is manually overridden. */
  overridden: boolean;
}

/**
 * Cost for one operation at a quantity. The raw per-unit is the time/legacy
 * formula UNLESS a manual per-unit override is set (then rawPerUnit = override,
 * applied across every quantity). Per-unit volume discount then op-level markup
 * give the final total/per-unit.
 */
export function computeOperationCost(op: Operation, qty: number): OperationCost {
  const overrideStr = op.unitPriceOverride?.trim() ?? "";
  const overridden = overrideStr !== "";

  const rawPerUnit = overridden ? num(overrideStr) : computedRawPerUnit(op, qty);
  const rawTotal = rawPerUnit * qty;

  const discountPct = volumeDiscountPct(op, qty);
  const discountedPerUnit = rawPerUnit * (1 - discountPct / 100);
  const perUnit = discountedPerUnit * (1 + markupFraction(op));
  return { total: perUnit * qty, perUnit, rawTotal, rawPerUnit, discountPct, overridden };
}

/** Total minutes an operation consumes at a quantity (setup once + run per unit). */
export function operationTimeMinutes(op: Operation, qty: number): number {
  const { setupMin, runMin } = timeFor(op);
  return setupMin + runMin * qty;
}

export function operationIsComplete(op: Operation): boolean {
  return OPERATION_CATALOGUE[op.type].fields.every(
    (f) => !f.required || (op.fields[f.key]?.trim() ?? "") !== "",
  );
}

/** Aggregate completeness selector — wired into the Complete button in Prompt 4. */
export function partIsComplete(input: {
  materials: MaterialCard[];
  operations: Operation[];
}): boolean {
  return input.materials.every(materialIsComplete) && input.operations.every(operationIsComplete);
}
