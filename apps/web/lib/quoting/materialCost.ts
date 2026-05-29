// Material cost calculation + data model for the estimate calculator.
// Pure module (no React / framework deps) so it can be unit-tested and reused.
// The formulae here are PLACEHOLDERS — real costing logic lands in a later epic.

export type MaterialType =
  | "online-round-bar"
  | "online-rect-bar"
  | "full-rect-bar"
  | "full-round-bar"
  | "sheet"
  | "pre-cut-blanks"
  | "structural-steel"
  | "extrusion"
  | "customer-provided"
  | "purchased-component"
  | "expense-material"
  | "tooling"
  | "online-sheet";

export interface MaterialTypeOption {
  id: MaterialType;
  label: string;
}

/** Order matches the type picker in screenshots 3_1 / 3_2. */
export const MATERIAL_TYPES: MaterialTypeOption[] = [
  { id: "online-round-bar", label: "Online: Round Bar" },
  { id: "online-rect-bar", label: "Online: Rectangular Bar" },
  { id: "full-rect-bar", label: "Full Rectangular Bar" },
  { id: "full-round-bar", label: "Full Round Bar" },
  { id: "sheet", label: "Sheet" },
  { id: "pre-cut-blanks", label: "Pre-Cut Blanks" },
  { id: "structural-steel", label: "Structural Steel" },
  { id: "extrusion", label: "Extrusion" },
  { id: "customer-provided", label: "Customer Provided" },
  { id: "purchased-component", label: "Purchased Component Hardware" },
  { id: "expense-material", label: "Expense (Material)" },
  { id: "tooling", label: "Tooling" },
  { id: "online-sheet", label: "Online: Sheet" },
];

export const ROUND_UP_OPTIONS = [
  { id: "exact", label: "Exact" },
  { id: "nearest-inch", label: "Round Up to Nearest Inch" },
  { id: "nearest-quarter-inch", label: "Round Up to Nearest 1/4 Inch" },
] as const;

export type RoundUpOption = (typeof ROUND_UP_OPTIONS)[number]["id"];

export interface MaterialCard {
  id: string;
  type: MaterialType;
  collapsed: boolean;
  // Sheet fields (numeric values kept as strings so inputs edit cleanly).
  material: string;
  thickness: string;
  costPerWeight: string;
  unfoldedLength: string;
  unfoldedWidth: string;
  blankLength: string;
  blankWidth: string;
  addBlanks: string;
  roundUp: RoundUpOption;
  /** Read-only display value (€), also feeds the placeholder cost formula. */
  fullSheetCost: number;
}

/** Field values mirror screenshot 3_0 (the default seeded Sheet card). */
export const SHEET_CARD_EXAMPLE: Omit<MaterialCard, "id"> = {
  type: "sheet",
  collapsed: false,
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
};

/** A blank card of the given type — required fields empty (render red). */
export function emptyCard(type: MaterialType): Omit<MaterialCard, "id"> {
  return {
    type,
    collapsed: false,
    material: "",
    thickness: "",
    costPerWeight: "",
    unfoldedLength: "",
    unfoldedWidth: "",
    blankLength: "",
    blankWidth: "",
    addBlanks: "1",
    roundUp: "exact",
    fullSheetCost: 0,
  };
}

/**
 * Placeholder cost: total = full sheet cost × blanks; per-unit = total / qty.
 * Real costing logic is swapped in later.
 */
export function computeMaterialCost(
  card: MaterialCard,
  qty: number,
): { total: number; perUnit: number } {
  const total = card.fullSheetCost * parseDecimal(card.addBlanks);
  const perUnit = qty > 0 ? total / qty : 0;
  return { total, perUnit };
}

/** Parse a user-entered number that may use a comma decimal separator (de-DE). */
export function parseDecimal(value: string | undefined): number {
  const n = Number(
    String(value ?? "")
      .trim()
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

/** Money for display, German formatting: 1.234,56 (thousands ".", decimal ","). */
export function formatAmount(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

/** Sheet cards require their core fields; other types are stubs (treated complete). */
export function materialIsComplete(card: MaterialCard): boolean {
  if (card.type !== "sheet") return true;
  return [
    card.material,
    card.thickness,
    card.costPerWeight,
    card.unfoldedLength,
    card.unfoldedWidth,
    card.blankLength,
    card.blankWidth,
  ].every((v) => v.trim() !== "");
}
