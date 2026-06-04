"use client";

import { FIELD_COLORS, type FieldHighlight, type SourceRegion } from "./field-identity";

/**
 * Reusable overlay that paints coloured highlight boxes on top of a rendered
 * pdf.js page, showing where the AI read each extracted value. Colours come from
 * the field colour-identity map (see field-identity.ts) so a box always matches
 * its verbatim pill.
 *
 * Coordinates: each region is normalised (0..1) fractions of the UNROTATED page.
 * The overlay is sized to the unrotated page (origin × scale), boxes are placed
 * in that space, and the whole layer is rotated to match the page — so a single
 * box definition scales correctly with any zoom, page rotation, and page size.
 *
 * SCAFFOLD: the extraction pipeline does not return bounding boxes yet, so
 * `highlights` is empty in practice and this renders nothing. It draws boxes only
 * for real regions — it never fabricates coordinates. See ADR 0011.
 */
export function PdfHighlightOverlay({
  highlights,
  page,
  pageWidth,
  pageHeight,
  scale,
  rotation,
}: {
  /** Highlights to paint (already resolved to field colour + region). */
  highlights: FieldHighlight[];
  /** Current 1-based page number; only same-page highlights are drawn. */
  page: number;
  /** Unrotated page width in PDF points (Page onLoadSuccess originalWidth). */
  pageWidth: number;
  /** Unrotated page height in PDF points (Page onLoadSuccess originalHeight). */
  pageHeight: number;
  /** Render scale (zoom / 100). */
  scale: number;
  /** Page rotation in degrees (0 | 90 | 180 | 270). */
  rotation: number;
}) {
  const onPage = highlights.filter((h) => h.region.page === page);
  if (onPage.length === 0 || !pageWidth || !pageHeight) return null;

  const w = pageWidth * scale;
  const h = pageHeight * scale;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    >
      {onPage.map((hl) => (
        <div
          key={hl.field}
          className="absolute rounded-[2px]"
          style={{
            left: hl.region.x * w,
            top: hl.region.y * h,
            width: hl.region.w * w,
            height: hl.region.h * h,
            backgroundColor: hl.color,
            outline: `1.5px solid ${hl.color}`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Resolve a part's per-field source regions into paintable highlights, pulling the
 * colour for each field from the colour-identity map. Returns [] when the part
 * carries no regions (the current stubbed state) so the overlay draws nothing.
 */
export function buildHighlights(
  sourceRegions: Record<string, SourceRegion> | undefined,
): FieldHighlight[] {
  if (!sourceRegions) return [];
  return Object.entries(sourceRegions).flatMap(([field, region]) => {
    const color = FIELD_COLORS[field]?.highlight;
    return color ? [{ field, color, region }] : [];
  });
}
