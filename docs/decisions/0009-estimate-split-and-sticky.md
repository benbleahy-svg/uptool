# ADR 0009 — Estimate Page: Custom Split Pane and Sticky Scope

## Status

Accepted

## Context

The per-part estimate / quoting page (`app/[orgSlug]/rfqs/[rfqId]/estimate/[partId]`)
is a full-area split screen: a quoting calculator on the left and a PDF/drawing
viewer on the right, separated by a draggable divider. The build prompt asked to
install the shadcn `resizable` component (which wraps `react-resizable-panels`)
and described the part-info header as "sticky (does not scroll)". Two points
needed a call that the prompt/brief did not settle cleanly.

## Decision

1. **Custom `SplitPane` instead of `react-resizable-panels`.** A ~90-line client
   component (`split-pane.tsx`) tracks the left pane width as a percentage, drags
   via window pointer events, supports keyboard resize (arrows / Home / End as a
   WAI-ARIA window splitter), and persists the position to `sessionStorage`. This
   avoids a new runtime dependency, matches the custom grab-handle in screenshot
   `0.1` exactly, and maps "persists for the session" to `sessionStorage` (the
   library defaults to cross-session `localStorage`).

2. **Only the Workflow + Qty toolbar is sticky; the part-info header scrolls.**
   The prompt prose said the header sticks, but screenshots `11_0`/`11_1` (the
   labelled "sticky/scroll behaviour" references) show the part-info header and
   AI-extraction table scrolling away while only the toolbar stays pinned. The
   headline rule "pixel-perfect to the screenshots — they win on conflict"
   resolves the tie toward the screenshots. Implemented as `sticky top-0` on the
   toolbar inside the single scroll container.

Minor, related:
- `popover` from the install list was **not** added — nothing in this prompt uses
  it. Add it when a feature needs it.
- `getMockPart(partId)` returns seeded data for the demo ids `p1`/`p2`/`p3` and
  falls back to the base-plate part (with the requested id) for any other
  non-empty id, so the page renders when reached with a real RFQ part uuid while
  the data layer is still stubbed. It returns `undefined` only for an empty id,
  which drives the page's empty state.

## Consequences

- Swapping to `react-resizable-panels` later is a contained change isolated to
  `split-pane.tsx` and its single consumer (`estimate-view.tsx`).
- If the prose intent (sticky part-info header) is preferred over the
  screenshots, it is a one-line structural change: move the header out of the
  scroll container (or mark it `sticky`) in `calculator.tsx`.
- New shared shadcn primitives were added to `packages/ui`: `dialog`,
  `dropdown-menu`, `tooltip` (the last pulled in `@radix-ui/react-tooltip`).
