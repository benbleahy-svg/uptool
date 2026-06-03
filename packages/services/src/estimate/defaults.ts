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
// Pure module — no framework, no DB imports.

/** Stub default shop rate (€80,00/h) mirroring the client rates source, which
 *  lives in apps/web and can't be imported across the services boundary. */
export const DEFAULT_HOURLY_RATE_CENTS = 8000;

/** A default operation shaped for a part_operations insert (orgId/partId added by
 *  the service). The 0021 override columns are intentionally left unset — a freshly
 *  seeded default is NOT user-touched. */
export interface DefaultOperationRow {
  name: string;
  operationType: string;
  setupMinutes: string;
  runMinutes: string;
  hourlyRateCents: number;
  isNonRecurring: boolean;
  sortOrder: number;
}

/**
 * Default operation rows for a freshly-hydrated part. Mirrors the time-based
 * operations from the client `seedOperations`, mapped to DB columns.
 *
 * @param _partArea unused — only the (omitted) rich Finishing default consumed it;
 *   kept for signature parity and future use.
 */
export function buildDefaultOperations(_partArea?: number): DefaultOperationRow[] {
  const rate = DEFAULT_HOURLY_RATE_CENTS;
  return [
    {
      name: "Programming",
      operationType: "programming",
      setupMinutes: "0",
      runMinutes: "0",
      hourlyRateCents: rate,
      isNonRecurring: true,
      sortOrder: 0,
    },
    {
      name: "CNC Milling",
      operationType: "cnc-milling",
      setupMinutes: "120",
      runMinutes: "60",
      hourlyRateCents: rate,
      isNonRecurring: false,
      sortOrder: 1,
    },
    {
      name: "QA / Inspection",
      operationType: "inspection",
      setupMinutes: "15",
      runMinutes: "3",
      hourlyRateCents: rate,
      isNonRecurring: false,
      sortOrder: 2,
    },
    {
      name: "Packaging & Shipping",
      operationType: "pack-and-ship",
      setupMinutes: "20",
      runMinutes: "1",
      hourlyRateCents: rate,
      isNonRecurring: false,
      sortOrder: 3,
    },
  ];
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
