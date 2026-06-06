// Canonical DB-row-shaped defaults seeded into part_operations / part_materials
// when a part is first opened in the calculator (see estimateService.hydratePartEstimate).
//
// These mirror the values the client currently seeds (apps/web operations-section
// `seedOperations` + materialCost `SHEET_CARD_EXAMPLE`) but shaped for the DB
// columns rather than the richer client model. Per ADR 0019:
//   - Only the TIME-BASED default operations are persisted (Programming, CNC
//     Milling, QA/Inspection, Packaging & Shipping). The client's rich-field ops
//     (Laser Cutting, Finishing) have no column home (part_operations has no
//     `fields` jsonb) and are intentionally omitted from the persisted defaults.
//   - The client `seedOperations`/`SHEET_CARD_EXAMPLE` are left untouched for now;
//     the client converges on these in prompt 3.
// DB-aware: operation rates are resolved from the org's operation_templates
// (Kalkulationsvorlagen). No framework imports.

import { db, operationTemplates } from "@uptool/db";
import { eq } from "drizzle-orm";

/** Fallback shop rate (€80,00/h) used only when an org has no matching
 *  operation_template for a default operation. */
export const DEFAULT_HOURLY_RATE_CENTS = 8000;

/** A default operation shaped for a part_operations insert (orgId/partId added by
 *  the service). setup/runtime rate cents are resolved from the org's
 *  operation_templates; the 0021 override columns are otherwise left unset — a
 *  freshly seeded default is NOT user-touched. */
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
}

/** The default operations, before rate resolution. Rates come from the org's
 *  operation_templates (matched by name, then operation_type). */
const DEFAULT_OPERATIONS: ReadonlyArray<{
  name: string;
  operationType: string;
  costCategory: "inside" | "outside" | "purchased";
  setupMinutes: string;
  runMinutes: string;
  isNonRecurring: boolean;
}> = [
  { name: "Programming", operationType: "programming", costCategory: "inside", setupMinutes: "0", runMinutes: "0", isNonRecurring: true },
  { name: "CNC Milling", operationType: "cnc-milling", costCategory: "inside", setupMinutes: "120", runMinutes: "60", isNonRecurring: false },
  { name: "QA / Inspection", operationType: "inspection", costCategory: "inside", setupMinutes: "15", runMinutes: "3", isNonRecurring: false },
  { name: "Packaging & Shipping", operationType: "pack-and-ship", costCategory: "inside", setupMinutes: "20", runMinutes: "1", isNonRecurring: false },
];

/**
 * Default operation rows for a freshly-hydrated part. Each operation's hourly rate
 * is resolved from the org's operation_templates (Kalkulationsvorlagen): match by
 * exact name first, then by operation_type, else fall back to €80/h with a warning
 * so the missing template is visible in dev.
 */
export async function buildDefaultOperations(orgId: string): Promise<DefaultOperationRow[]> {
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

  return DEFAULT_OPERATIONS.map((op, i) => {
    const matched = byName.get(op.name) ?? byType.get(op.operationType);
    if (matched == null) {
      console.warn(
        `[buildDefaultOperations] no operation_template for "${op.name}" (type ${op.operationType}) in org ${orgId} — falling back to €${DEFAULT_HOURLY_RATE_CENTS / 100}/h`,
      );
    }
    const rate = matched ?? DEFAULT_HOURLY_RATE_CENTS;
    return {
      name: op.name,
      operationType: op.operationType,
      costCategory: op.costCategory,
      setupMinutes: op.setupMinutes,
      runMinutes: op.runMinutes,
      hourlyRateCents: rate,
      setupRateCents: rate,
      runtimeRateCents: rate,
      isNonRecurring: op.isNonRecurring,
      sortOrder: i,
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
