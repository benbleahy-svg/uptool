# ADR 0010 — Estimate: Lifted Totals State, Completion Store, Footer Nav

## Status

Accepted

## Context

The final estimate page features (sticky Total row, price-breakdown popover,
footer Complete/No-Bid, and the cross-part completion tick in the RFQ sidebar)
all need data that spans Materials **and** Operations, and some of it must
survive navigation between parts and reach a component (the sidebar) in a
different subtree.

## Decision

1. **Lifted Materials + Operations state into `Calculator`.** The Total row,
   `partIsComplete`, and the breakdown popover all read both lists, so
   `MaterialsSection` / `OperationsSection` became controlled (state + setter
   props). Totals and breakdown live in pure `lib/quoting/estimateTotals.ts`.

2. **Cross-part completion via `lib/quoting/partCompletion.ts`** — a
   sessionStorage-backed store keyed by the resolved RFQ id, with a same-tab
   `CustomEvent` so the footer (which writes status) and the RFQ sidebar (which
   renders the blue ✓ / dashed no-bid circle) stay in sync across route changes.
   Chosen over React context because the two consumers live in separate subtrees
   (page vs. layout) and state must persist across per-part navigations.

3. **Footer part-nav uses the real RFQ parts.** `page.tsx` now resolves the RFQ
   and passes the ordered part ids; the footer routes prev/next and "advance to
   next unfinalised part" over them. Falls back to `MOCK_RFQ_PARTS` for the
   standalone demo when the current part id isn't a real RFQ part. Completion is
   keyed by the resolved RFQ id + part id so the sidebar (same ids) shows ticks.

4. **Removed the Prompt-3 floating "+" FAB.** The finalized bottom chrome (sticky
   Total row + pinned footer) occupies the bottom-right where the FAB floated,
   so it would overlap. The Operations heading "+" remains the add trigger.

5. **HoverCard for the price breakdown** (`@radix-ui/react-hover-card`): hover to
   open (~150ms), instant close, rich content (staggered colour bar + axis +
   per-segment tooltips) — the idiomatic primitive for a hover-triggered card.

## Consequences

- Re-instating the FAB later means positioning it above the Total row/footer
  (e.g. an absolutely-positioned pane-level element), not inside the scroll.
- Completion is session-scoped (clears on tab close); persisting to the DB is a
  later epic — `partCompletion.ts` is the single seam to swap.
- The breakdown $ values are placeholders (per Prompts 2–3 formulae); the popover
  renders structure (bar/axis/categories), not real costs.
