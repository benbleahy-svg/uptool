// Adapter between the persisted DB rows (PartOperation / PartMaterial) and the
// client working models (Operation / MaterialCard), plus translators from a
// client patch to the DB action arguments. Pure module — imported by both the
// Server Component (DB→client) and the client calculator (client→action).
//
// Only TYPES are imported from @uptool/services (erased at compile, so no server
// code is bundled into the client). The persisted model is time-based only; see
// ADR 0020 for the fields the client carries that have no column yet.

import {
  type MaterialCard,
  type MaterialType,
  type RoundUpOption,
  parseDecimal,
} from "@/lib/quoting/materialCost";
import {
  DEFAULT_VOLUME_TIERS,
  OPERATION_CATALOGUE,
  type Operation,
  type OperationType,
  type VolumeTier,
} from "@/lib/quoting/operationCost";
import type {
  AddOperationInput,
  PartMaterial,
  PartOperation,
  UpdateOperationInput,
} from "@uptool/services";

const OP_TYPES = Object.keys(OPERATION_CATALOGUE) as OperationType[];
function toOperationType(s: string): OperationType {
  return OP_TYPES.includes(s as OperationType) ? (s as OperationType) : "generic";
}

/** DB numeric/cents → de-formatted client string (decimal comma). */
const deDecimal = (s: string | number): string => String(s).replace(".", ",");
const centsToEuro = (c: number | null | undefined): string => (c == null ? "" : deDecimal(c / 100));

// ─── DB row → client model ────────────────────────────────────────────────────

/** Map a persisted operation row to the client Operation working model. */
export function dbOperationToClient(row: PartOperation): Operation {
  const type = toOperationType(row.operationType);
  const fields: Record<string, string> =
    type === "programming"
      ? { time: deDecimal(row.setupMinutes) }
      : { setupTime: deDecimal(row.setupMinutes), runTime: deDecimal(row.runMinutes) };

  const tiers: VolumeTier[] = Array.isArray(row.volumeDiscountTiers)
    ? row.volumeDiscountTiers.map((t) => ({
        qty: String(t.minQty),
        discountPct: deDecimal(t.discountPct),
      }))
    : DEFAULT_VOLUME_TIERS.map((t) => ({ ...t }));

  return {
    id: row.id,
    type,
    name: row.name,
    collapsed: true,
    fields,
    nonRecurring: row.isNonRecurring,
    costCategory: row.costCategory as Operation["costCategory"],
    timeSource: row.timeSource as Operation["timeSource"],
    userTouched: row.userTouched,
    setupRate: centsToEuro(row.setupRateCents),
    runtimeRate: centsToEuro(row.runtimeRateCents),
    volumeDiscount: row.volumeDiscountTiers != null,
    volumeTiers: tiers,
    markupPct: row.markupPct != null ? deDecimal(row.markupPct) : "0",
    note: "", // op-level note hidden until the fields-jsonb epic (ADR 0020)
    unitPriceOverride: centsToEuro(row.unitPriceOverrideCents),
  };
}

/** Map a persisted material row to the client MaterialCard working model. */
export function dbMaterialToClient(row: PartMaterial): MaterialCard {
  const f = (row.fields ?? {}) as Record<string, unknown>;
  const str = (k: string) => String(f[k] ?? "");
  return {
    id: row.id,
    type: row.materialType as MaterialType,
    collapsed: false,
    material: str("material"),
    thickness: str("thickness"),
    costPerWeight: str("costPerWeight"),
    unfoldedLength: str("unfoldedLength"),
    unfoldedWidth: str("unfoldedWidth"),
    blankLength: str("blankLength"),
    blankWidth: str("blankWidth"),
    addBlanks: str("addBlanks"),
    roundUp: (f.roundUp as RoundUpOption) ?? "exact",
    fullSheetCost:
      typeof f.fullSheetCost === "number" ? f.fullSheetCost : Number(f.fullSheetCost ?? 0),
  };
}

// ─── client model → DB action args ──────────────────────────────────────────

/** A single debounced/immediate save derived from a client operation patch. */
export type OpSave =
  | { key: string; kind: "update"; patch: UpdateOperationInput }
  | { key: string; kind: "clearOverride" };

const rateCents = (s: string): number | null =>
  s.trim() === "" ? null : Math.round(parseDecimal(s) * 100);

function tiersToDb(enabled: boolean, tiers: VolumeTier[]) {
  return enabled
    ? tiers.map((t) => ({
        minQty: Math.round(parseDecimal(t.qty)),
        discountPct: parseDecimal(t.discountPct),
      }))
    : null;
}

/**
 * Translate a client Operation patch into one save per changed user-controlled
 * field (so edits to distinct fields debounce independently). Returns [] for
 * patches that aren't persisted (collapsed, rate id, note).
 */
export function opPatchToSaves(prevOp: Operation, patch: Partial<Operation>): OpSave[] {
  const out: OpSave[] = [];
  if (patch.fields) {
    const f = patch.fields;
    if (prevOp.type === "programming") {
      if (f.time !== prevOp.fields.time)
        out.push({
          key: "setupMinutes",
          kind: "update",
          patch: { setupMinutes: parseDecimal(f.time ?? "") },
        });
    } else {
      if (f.setupTime !== prevOp.fields.setupTime)
        out.push({
          key: "setupMinutes",
          kind: "update",
          patch: { setupMinutes: parseDecimal(f.setupTime ?? "") },
        });
      if (f.runTime !== prevOp.fields.runTime)
        out.push({
          key: "runMinutes",
          kind: "update",
          patch: { runMinutes: parseDecimal(f.runTime ?? "") },
        });
    }
  }
  if (patch.name !== undefined)
    out.push({ key: "name", kind: "update", patch: { name: patch.name } });
  if (patch.costCategory !== undefined)
    out.push({
      key: "costCategory",
      kind: "update",
      patch: { costCategory: patch.costCategory },
    });
  if (patch.nonRecurring !== undefined)
    out.push({
      key: "isNonRecurring",
      kind: "update",
      patch: { isNonRecurring: patch.nonRecurring },
    });
  if (patch.markupPct !== undefined)
    out.push({
      key: "markupPct",
      kind: "update",
      patch: { markupPct: parseDecimal(patch.markupPct) },
    });
  if (patch.setupRate !== undefined)
    out.push({
      key: "setupRateCents",
      kind: "update",
      patch: { setupRateCents: rateCents(patch.setupRate) },
    });
  if (patch.runtimeRate !== undefined)
    out.push({
      key: "runtimeRateCents",
      kind: "update",
      patch: { runtimeRateCents: rateCents(patch.runtimeRate) },
    });
  if (patch.volumeDiscount !== undefined || patch.volumeTiers !== undefined) {
    const enabled = patch.volumeDiscount ?? prevOp.volumeDiscount;
    const tiers = patch.volumeTiers ?? prevOp.volumeTiers;
    out.push({
      key: "volumeDiscountTiers",
      kind: "update",
      patch: { volumeDiscountTiers: tiersToDb(enabled, tiers) },
    });
  }
  if (patch.unitPriceOverride !== undefined) {
    out.push(
      patch.unitPriceOverride.trim() === ""
        ? { key: "unitPriceOverrideCents", kind: "clearOverride" }
        : {
            key: "unitPriceOverrideCents",
            kind: "update",
            patch: {
              unitPriceOverrideCents: Math.round(parseDecimal(patch.unitPriceOverride) * 100),
            },
          },
    );
  }
  return out;
}

/** Add-operation input from a freshly-created client op (base time fields). */
export function clientOpToAddInput(op: Operation): AddOperationInput {
  const setup = op.type === "programming" ? op.fields.time : op.fields.setupTime;
  return {
    name: op.name,
    operationType: op.type,
    costCategory: op.costCategory,
    timeSource: op.timeSource,
    setupMinutes: parseDecimal(setup ?? ""),
    runMinutes: parseDecimal(op.fields.runTime ?? ""),
    isNonRecurring: op.nonRecurring,
  };
}

/** Full DB patch for an op — used when copying so the copy persists its extras. */
export function clientOpToFullPatch(op: Operation): UpdateOperationInput {
  return {
    costCategory: op.costCategory,
    timeSource: op.timeSource,
    markupPct: parseDecimal(op.markupPct),
    setupRateCents: rateCents(op.setupRate),
    runtimeRateCents: rateCents(op.runtimeRate),
    volumeDiscountTiers: tiersToDb(op.volumeDiscount, op.volumeTiers),
    unitPriceOverrideCents:
      op.unitPriceOverride.trim() === ""
        ? null
        : Math.round(parseDecimal(op.unitPriceOverride) * 100),
  };
}

/** Whole-blob material payload (the service replaces `fields` wholesale). The
 *  concrete shape satisfies both AddMaterialInput and UpdateMaterialInput. */
export function clientMaterialToFields(card: MaterialCard): {
  materialType: string;
  fields: Record<string, unknown>;
} {
  const { id: _id, type, collapsed: _collapsed, ...fields } = card;
  return { materialType: type, fields: fields as Record<string, unknown> };
}

/**
 * Field-scoped revert: restore ONLY the client field behind a failed save's
 * `OpSave.key`, taken from `snapshot`, merged onto the CURRENT op so sibling
 * fields (edited/committed separately) keep their values. Prevents a failed
 * save on one field from clobbering another — and a stale displayed cost.
 */
export function revertOpField(current: Operation, snapshot: Operation, key: string): Operation {
  switch (key) {
    case "setupMinutes": {
      const fk = current.type === "programming" ? "time" : "setupTime";
      return { ...current, fields: { ...current.fields, [fk]: snapshot.fields[fk] ?? "" } };
    }
    case "runMinutes":
      return { ...current, fields: { ...current.fields, runTime: snapshot.fields.runTime ?? "" } };
    case "name":
      return { ...current, name: snapshot.name };
    case "isNonRecurring":
      return { ...current, nonRecurring: snapshot.nonRecurring };
    case "markupPct":
      return { ...current, markupPct: snapshot.markupPct };
    case "setupRateCents":
      return { ...current, setupRate: snapshot.setupRate };
    case "runtimeRateCents":
      return { ...current, runtimeRate: snapshot.runtimeRate };
    case "volumeDiscountTiers":
      return {
        ...current,
        volumeDiscount: snapshot.volumeDiscount,
        volumeTiers: snapshot.volumeTiers,
      };
    case "unitPriceOverrideCents":
      return { ...current, unitPriceOverride: snapshot.unitPriceOverride };
    default:
      return current;
  }
}
