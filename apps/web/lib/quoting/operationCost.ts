// Operation cost calculation + catalogue for the estimate calculator.
// Pure module (no React) so it can be unit-tested and reused.
// Formulae are PLACEHOLDERS — real costing logic lands in a later epic.

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

export interface Operation {
  id: string;
  type: OperationType;
  name: string;
  collapsed: boolean;
  fields: Record<string, string>;
  nonRecurring: boolean;
  outside: boolean;
}

/** Stubbed shop rate until per-op / configurable rates arrive. */
export const HOURLY_RATE = 100;

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
    name: "Inspection",
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
    name: "Pack and Ship",
    nonRecurring: false,
    outside: false,
    fields: [runTime],
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
  };
}

/** Map setup/run minutes from an operation's fields for the placeholder cost. */
function timeFor(op: Operation): { setupMin: number; runMin: number } {
  const f = op.fields;
  switch (op.type) {
    case "programming":
      return { setupMin: num(f.time), runMin: 0 };
    case "pack-and-ship":
      return { setupMin: 0, runMin: num(f.runTime) };
    case "laser-cutting":
      return { setupMin: num(f.setupTime), runMin: num(f.cycleTime) };
    default:
      return { setupMin: num(f.setupTime), runMin: num(f.runTime) };
  }
}

/**
 * Placeholder cost. Time-based: per-unit = ((setup/qty) + run) × rate / 60,
 * total = per-unit × qty. Finishing: total = max(minBatch, cost × area × qty).
 */
export function computeOperationCost(
  op: Operation,
  qty: number,
): { total: number; perUnit: number } {
  if (op.type === "finishing") {
    const total = Math.max(
      num(op.fields.minBatch),
      num(op.fields.cost) * num(op.fields.partArea) * qty,
    );
    return { total, perUnit: qty > 0 ? total / qty : 0 };
  }
  const { setupMin, runMin } = timeFor(op);
  const perUnit = ((qty > 0 ? setupMin / qty : 0) + runMin) * (HOURLY_RATE / 60);
  return { total: perUnit * qty, perUnit };
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
