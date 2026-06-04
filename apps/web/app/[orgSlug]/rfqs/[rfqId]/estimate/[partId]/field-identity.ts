// Single source of truth for the AI-extraction "colour identity": one consistent
// colour per extracted field type. These colours drive BOTH the verbatim
// highlight pills in the extraction table (calculator.tsx) AND — once the
// extraction pipeline returns bounding boxes — the highlighted regions painted on
// the PDF drawing (pdf-highlight-overlay.tsx). Keeping them here means a pill and
// its corresponding on-drawing box can never drift apart in colour.
//
// See ADR 0011 for the highlight scaffold and the bounding-box dependency.

/** A field's colour identity. `fill`/`text` style the pill; `highlight` is the
 *  semi-transparent fill used when painting the same field onto the PDF canvas. */
export interface FieldColor {
  /** Pill background. */
  fill: string;
  /** Pill text. */
  text: string;
  /** Pill / highlight border. */
  border: string;
  /** Canvas highlight fill (carries its own alpha). */
  highlight: string;
}

/** Colour identity keyed by the field label shown in the table. Only fields that
 *  carry a verbatim value need an entry; geometry fields are computed and have no
 *  verbatim, so they render no pill. */
export const FIELD_COLORS: Record<string, FieldColor> = {
  Description: {
    fill: "#dcf5e3",
    text: "#166534",
    border: "#86d29b",
    highlight: "rgba(34, 197, 94, 0.28)",
  },
  Material: {
    fill: "#fcdada",
    text: "#9f1239",
    border: "#f1a8a8",
    highlight: "rgba(244, 63, 94, 0.28)",
  },
  Finish: {
    fill: "#e0e7ff",
    text: "#3730a3",
    border: "#a5b4fc",
    highlight: "rgba(99, 102, 241, 0.28)",
  },
};

/** Where an extracted value was read from. Distinct types (no longer the collapsed
 *  "Technical Drawing / CAD") so the Source column can label each field precisely. */
export type SourceType = "Technical Drawing" | "CAD Model" | "Calculated";

/** Plain (light-bg, coloured-text) pill styling per source type, matching the
 *  reference. Subtler than the field-identity pills above. */
export const SOURCE_STYLES: Record<SourceType, { fill: string; text: string }> = {
  "Technical Drawing": { fill: "#e0e7ff", text: "#4338ca" },
  "CAD Model": { fill: "#d1fae5", text: "#047857" },
  Calculated: { fill: "#eef0f2", text: "#52606d" },
};

/**
 * A bounding box locating where the AI read a value on the source drawing.
 * Coordinates are normalised fractions (0..1) of the UNROTATED page, origin
 * top-left — resolution-independent, so they scale with any zoom and the overlay
 * applies page rotation itself. `page` is 1-based.
 *
 * The extraction pipeline does not return these yet (extraction is stubbed), so
 * every extracted field currently leaves `sourceRegion` undefined and no
 * highlight is drawn. Do NOT fabricate values here.
 */
export interface SourceRegion {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One painted highlight: a field's colour + the box to paint it in. */
export interface FieldHighlight {
  field: string;
  color: string;
  region: SourceRegion;
}
