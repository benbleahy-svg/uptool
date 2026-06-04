# ADR 0016 — Extraction Colour Identity, Source Types, and PDF Source-Highlight Scaffold

## Status

Accepted

## Context

The per-part estimate page (`app/[orgSlug]/rfqs/[rfqId]/estimate/[partId]`) shows an
AI-extraction table (Field / Value / Verbatim / Source). The reference
(`assets/description ref + colour indenity.png`) asks for three visible changes
plus scaffolding for a feature that depends on extraction data we do not have yet.

Important context on data state:

- **Extraction is still stubbed.** The table is built by `buildRows()` in
  `calculator.tsx` from hard-coded values in `mocks/mockPart.ts`. No AI model is
  called; there is no part-extraction service. (DB has an `ai_runs` table and a
  customer-name deriver, but no part field extraction.)
- **The extraction output carries no source coordinates.** Each stubbed field has
  only a value, a verbatim string, and (now) a source type — no page or
  bounding-box geometry.

## Decision

1. **Field colour identity in one place.** `field-identity.ts` holds `FIELD_COLORS`
   (one colour per field that has a verbatim value: Description = green, Material =
   pink/red, Finish = indigo). Each entry carries the pill `fill`/`text` colours
   *and* a `highlight` (semi-transparent canvas fill). This single map drives both
   the verbatim pills in the table and — once coordinates exist — the highlight
   boxes painted on the drawing, so a pill and its on-drawing box can never drift.

2. **Verbatim rendered as a coloured pill** (`VerbatimPill`), not grey italic text.
   Geometry rows have no verbatim and render nothing in that column.

3. **Distinct source types** replace the collapsed `"Technical Drawing / CAD"`
   badge. `SourceType` = `Technical Drawing | CAD Model | Calculated`, assigned
   per field in `buildRows()` (text fields → drawing, geometry → CAD model, weight
   → calculated) and rendered by `SourcePill` with the plain light-bg colour styling
   from the reference (`SOURCE_STYLES`). The old single `Part.source` field was
   removed as it is no longer used.

4. **Header is now fixed/sticky — reverses ADR 0009 §2.** ADR 0009 chose to let the
   part-info header and extraction table scroll away (only the toolbar pinned),
   citing the then-current screenshots. The new reference and this prompt require
   the whole description/header section (part info + extraction table + workflow/qty
   toolbar) to stay in view while materials/operations scroll. Implemented by
   splitting the single scroll container in `calculator.tsx` into a `flex-none`
   header block and a `flex-1 overflow-auto` body. The toolbar no longer needs its
   own `sticky` now that it lives in the fixed block.

5. **PDF source-highlight: rendering side built, data side stubbed.**
   `pdf-highlight-overlay.tsx` exports `PdfHighlightOverlay`, a reusable overlay
   that paints coloured boxes over a rendered pdf.js page. It takes a field's colour
   (from the map) + a normalised bounding box and scales correctly with zoom, page
   rotation, and page size (regions are 0..1 fractions of the unrotated page; the
   layer is sized to the unrotated page and rotated to match). It is wired through
   `FileViewerPane` → `DrawingViewer`, driven by an **optional** per-field
   `Part.sourceRegions` map.

   **No coordinates are fabricated.** `mockPart` sets no regions, so
   `buildHighlights()` returns `[]` and the overlay renders nothing today — the
   pills still get their colours. This is deliberate: real highlights light up only
   when the extraction pipeline starts returning bounding boxes.

## Consequences

- **TODO — depends on the extraction pipeline.** When extraction returns per-field
  page + bounding-box coordinates, populate `Part.sourceRegions` (or the real
  extracted-field model that replaces it) and the green/pink/indigo boxes appear on
  the drawing automatically, matching each verbatim pill. No overlay changes needed.
- Coordinate convention is normalised (0..1) of the unrotated page so it is
  resolution- and zoom-independent; the extraction adapter must emit that form (or
  be converted at the boundary).
- ADR 0009 §2 is superseded on the sticky question; its split-pane decision stands.
