# ADR 0008 — TU Glyph as Temporary Brand Mark

## Status

Accepted

## Context

The sidebar requires a compact brand mark that fits within a 72 px column. A proper logo (SVG wordmark or icon) has not been finalised.

## Decision

Use a 32 px rounded square containing the letters "TU" in bold JetBrains Mono, filled with the primary blue (`hsl(var(--primary))`), with the text "toolup" in 10 px muted grey beneath it. This is implemented inline in `apps/web/components/sidebar.tsx` and does not use the `Wordmark` component (which renders the full horizontal wordmark at larger sizes).

## Consequences

- Requires a single-file change when the final brand mark is ready: replace the inline `<div>` in the sidebar brand area with an `<Image>` or SVG component.
- The `BRAND.name` constant in `packages/shared/src/brand.ts` remains the single source of truth for the brand name string; the glyph is purely presentational.
