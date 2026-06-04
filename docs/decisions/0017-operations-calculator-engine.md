# ADR 0017 — Operations: Interactive Rows + Real Cost Engine

## Status

Accepted

## Context

The estimate-page Operations section was a skeleton: operation rows showed a name,
a collapse chevron, and per-qty price columns driven by a **placeholder** cost
formula (`per-unit = ((setup/qty) + run) × HOURLY_RATE/60`, flat €100/h). The
reference (screenshots 1.0–1.4) specifies a full interactive operation row with a
real costing engine, rate panel, volume discount, operation markup, and per-cell
override. This ADR records the decisions made building it.

## Decisions

1. **Real cost engine in `operationCost.ts`** (replaces the placeholder):
   - `total time per qty = setupMin + runMin × qty` — setup is one-time per
     batch, run is per unit.
   - `cost = setupHr × SetupRate + (runHr × qty) × RuntimeRate` — setup and run
     use **separate** €/hour rates; minutes→hours conversion.
   - Grid "X hr" headers = total time at that qty (CNC 120/60 → 3/7/52 hr at
     qty 1/5/50). Verified in-app.
   - Per-unit = total ÷ qty.
   - `computeOperationCost` now returns a rich `OperationCost`
     (`total`/`perUnit` = final; `rawTotal`/`rawPerUnit` = pre-discount/markup;
     `discountPct`; `overridden`). The previous `{total, perUnit}` consumers
     (`estimateTotals.ts`) keep working unchanged.

2. **Volume discount** — opt-in per operation, editable tier table (defaults
   1+→0%, 10+→5%, 100+→10%, 1000+→15%, persisted on the operation). The discount
   is applied to the **per-unit** cost at the highest threshold the qty meets
   (qty 50 → 5%). Confirmed against 1.2 (4.160 → 3.952 € at qty 50).

3. **Operation-level markup** — an internal margin applied **after** cost
   (`final = discounted × (1 + markup%)`). It is the bottom row of the expanded
   grid and lives entirely inside the operation; it feeds the part total but is
   **separate** from the quote-page customer markup (different code path, applied
   later on the quote) — the two are never double-counted.

4. **Per-cell override** — the expanded grid's "Total" cells are editable. Typing
   sets a per-qty override of the **raw** total (`Operation.priceOverrides`,
   keyed by quantity), derives the per-unit "Cost" cell, renders both **blue**,
   and the value **sticks** (not recalculated when inputs change). **Revert:
   clearing the cell** (empty string) removes the override and restores the
   calculated value — confirmed in-app. The per-unit "Cost" cell is read-only
   (derived); the Total cell is the single override entry point to avoid
   reformat-while-typing races on a linked pair. Volume discount + markup still
   apply on top of an override.

5. **Rates source = calculator-templates settings.** Hourly rates live in
   `app/[orgSlug]/settings/calculator-templates/rates.ts` (a pure data module —
   the settings home for "Kalkulationsvorlagen" rates), **stubbed at €80,00/h**
   with a single "Default" entry. The engine and the rate dropdowns read from it;
   nothing hardcodes a rate inline, so wiring real per-shop rates later is a
   one-file change. The "Default" dropdown selects which configured rate an
   operation uses (`setupRateId` / `runtimeRateId`).

   The €/h amount is **editable per operation** (`setupRate` / `runtimeRate`
   overrides on the `Operation`): the user can type a different rate, which
   recomputes that operation's prices and renders blue. It **defaults to the
   configured rate and reverts** to it when the field is cleared or the reset
   (↺) icon is clicked — `effectiveRate(rateId, override)` returns the override
   when set, else the configured default. The override is per-operation and
   transient (in-memory), so rates always fall back to the configured default.

6. **Scope: time-based vs legacy ops.** The new model (inline header inputs,
   rate panel, discount, markup, override) applies to **time-based** ops
   (Programming, CNC Milling, QA/Inspection, Packaging & Shipping, Deburr,
   Bending, generic), keyed off a `TIME_MODEL` map. **Laser Cutting** and
   **Finishing** keep their existing field bodies and placeholder formulae
   (no rate panel) until their real models land — surgical, no behaviour change
   for them. `isTimeBased()` / `opTimeKind()` gate the UI.

7. **Reference-matching touch-ups:** `inspection` renamed to "QA / Inspection",
   `pack-and-ship` to "Packaging & Shipping" (now Setup + Run, was Run-only).
   The seed (`seedOperations`) now mirrors reference 1.0 — Programming + CNC
   start empty/filled to show both the red-ring (incomplete → no price) and
   priced states — with Laser + Finishing kept last so the legacy bodies stay on
   show. Non-recurring ops show an **"NR"** badge on the icon. Filled inline
   inputs and overridden cells render **blue** (a new `highlightFilled` option on
   `FloatingField`; a `blue` flag on `PricingCell`). All money is EUR, de-DE
   formatted (`€80,00/h`, `4.160 €`).

## Consequences

- `Operation` gained `setupRateId`, `runtimeRateId`, `volumeDiscount`,
  `volumeTiers`, `markupPct`, `note`, `priceOverrides`. `createOperation` seeds
  sensible defaults, so all existing spread-based call sites keep compiling.
- Real per-shop rates: replace the stub array in `calculator-templates/rates.ts`
  and render an editor on that settings page; no calculator changes needed.
- Override is stored as the raw total per quantity. Changing a row's quantity in
  the toolbar drops an override tied to the old quantity (acceptable — overrides
  are quantity-specific).
