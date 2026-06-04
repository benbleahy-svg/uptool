# ADR 0020 — Wiring the Estimate Calculator to Persistence

## Status

Accepted

## Context

Prompt 3 of 4 in the estimate-persistence epic. Prompt 1 = schema (0021),
prompt 2 = `estimateService` + server actions + test harness. The calculator was
still in-memory `useState` seeded from client mocks. This prompt makes it read and
write the DB so a refresh preserves estimator inputs.

The persisted model (`part_operations` / `part_materials`) is **time-based only**
and narrower than the client `Operation` model. Five reconciliation calls were
approved before coding (Step 1).

## Decisions

1. **Load + hydrate in the Server Component.** `page.tsx` requires a real DB part
   (else "Part not found" — the `p1/p2/p3` calculator demo is retired); calls
   `hydratePartEstimate` when `estimateHydratedAt` is null; loads ops/materials/
   notes; maps DB rows → client models via a pure `persistence.ts` adapter; and
   passes them as initial props. Hydration/load failure renders an explicit error
   (never a silent mock fallback). A `loading.tsx` shows "Loading estimate…".

2. **Header stays mock.** Geometry + the AI-extraction verbatim table come from
   `getMockPart` (extraction epic, out of scope); the page overlays the **real**
   part identity (number/description/material/finish) so it isn't mistaken for
   real geometry. `MOCK_PARTS` (p1/p2/p3) and `MOCK_RFQ_PARTS` were removed.

3. **Optimistic + debounced saves (`use-estimate-sync.ts`).** A small `useTransition`
   hook: `schedule(key, …)` debounces 500ms per key (rapid edits to one field →
   one request; distinct fields independent); `runNow` fires immediately (add/
   delete/reorder). Network failures retry ~3× with exponential backoff; a handled
   `{ok:false}` does not retry. On give-up or `{ok:false}`: revert the optimistic
   change + toast "Couldn't save — your last change has been undone." A "Saving…"
   hint shows by the title while requests are in flight. **No new deps** (no React
   Query/SWR/Zustand). Last-write-wins (known limitation).

4. **DB↔client adapter (`persistence.ts`, pure).** Maps each persisted row to the
   client working model and each client patch to action args (one save per changed
   field). Only TYPES are imported from `@uptool/services`, so no server code is
   bundled client-side. Optimistically-added rows use a `tmp-` id reconciled to the
   real id when the action returns.

5. **Reconciliation (approved):**
   - **Rich-field ops** (Laser Cutting, Finishing) **hidden** from the Add popover
     — their field bags have no DB column. They return with the fields-jsonb epic.
   - **Op-level "+ Note"** hidden (no column); part-level notes persist.
   - **Per-unit override (E1):** the per-qty override grid collapses to **one**
     per-unit override per operation (Total per column = override × qty); persists
     as `unit_price_override_cents`. Per-qty independence returns with the
     fields-jsonb epic. Engine (`operationCost.ts`) changed `priceOverrides`
     (per-qty map) → a single `unitPriceOverride`.
   - **Quote bulk (2.6) deferred** entirely — the quote page is fully mock and its
     bulk model differs from the schema. `updateRfqQuoteBulk` is ready but unwired;
     wired in the quote-persistence epic.

6. **Reset convergence (2.8).** `rfqService.resetEstimate` now also deletes
   `part_materials`, nulls `parts.estimateHydratedAt` (so the next open re-seeds
   defaults), and clears `rfqs.quoteBulk*`. After reset the page re-keys on
   `estimateHydratedAt`, remounting the calculator with the re-seeded defaults
   (no manual client reset needed). Service test extended.

## Consequences / verified

Verified live against a real seeded part: hydration seeds 4 ops + 1 material;
editing Setup Time 120→200 survives refresh (DB `setup=200`, `user_touched=true`);
10 rapid keystrokes → **exactly 1** action POST (final value persisted); add op
persists (4→5); per-unit override persists (`99900`, cell blue); clearing it
reverts and **keeps `user_touched=true`**; an offline edit reverts after retries
with no silent data loss. `estimateService.resetEstimate` test green.

**Known scope gaps (flagged):** quantity columns are still client-only and seeded
from the mock header (not `rfqs.quantityBreaks`) — quantity persistence wasn't in
scope. Header geometry/AI table remain mock. Concurrency is last-write-wins.
