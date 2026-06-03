# ADR 0019 — Estimate Persistence: Services Layer + Server Actions

## Status

Accepted

## Context

Prompt 2 of 4 in the estimate-persistence epic. Schema landed in migration 0021
(`part_operations` 0021 columns, `part_materials`, `parts.estimateHydratedAt`,
`rfqs.quoteBulk*`). This adds the **write path** — services + server actions.
No client wiring yet (prompt 3). Last-write-wins, no version column (documented
limitation).

## Decisions

1. **New `estimateService` module** (`packages/services/src/estimate/`) owns the
   whole estimate write surface: `hydratePartEstimate`, operations CRUD
   (`list/add/update/delete/reorder` + `clearPartOperationOverride`), materials
   CRUD, `updatePartNotes`, `updateRfqQuoteBulk`. The legacy
   `partService.addOperation/updateOperation/deleteOperation/updatePartNotes`
   (pre-0021 columns, only called by unwired legacy actions) are **left in place**
   to avoid touching unrelated call sites; the duplication is flagged for cleanup
   in a later prompt.

2. **Persisted operation model = the time-based subset** (approved option A). The
   client `Operation` is richer than `part_operations`: its `fields` bag
   (laser/finishing inputs), operation-level `note`, and **per-quantity** price
   overrides have **no column home**. We persist name, `operation_type` (free
   text — preserves the client type id), setup/run minutes, hourly/ setup/runtime
   rates (cents), markup, a single `unit_price_override_cents`, volume-discount
   tiers, `is_non_recurring`. The unmapped pieces are a known limitation; the
   client reconciles to this model in prompt 3. No schema change (out of scope).

3. **DB-shaped defaults in services** (`estimate/defaults.ts`):
   `buildDefaultOperations()` (the 4 time-based default ops — Programming, CNC
   Milling, QA/Inspection, Packaging & Shipping — mirroring the client seeds
   mapped to DB columns; rich laser/finishing defaults omitted) and
   `buildDefaultMaterials()` (one Sheet card → `material_type` + `fields` jsonb).
   `DEFAULT_HOURLY_RATE_CENTS = 8000` (€80/h) mirrors the client rates stub, which
   can't be imported across the services boundary. **The client `seedOperations`
   / `SHEET_CARD_EXAMPLE` are left untouched** for now (different, client shape) —
   they still feed `useState`. **⚠️ Prompt-3 flag:** the client's default source
   converges on `@uptool/services` then (import path changes), and the client
   Operation/Material model is reconciled to the DB model.

4. **Validation + typed errors.** Added `zod` to `packages/services` deps; all
   inputs validated via `estimate/schemas.ts` → `ValidationError` on failure.
   Cross-org access (org-scoped WHERE matches nothing) surfaces as
   `NotFoundError`. Percentages validated 0–100 in-service for a clearer message
   than the DB CHECK.

5. **`user_touched` semantics.** Set `true` when a row is explicitly added
   (user-created, not a seeded default) and on any update that mutates a
   user-controlled field. `clearPartOperationOverride` nulls the override column
   but **leaves `user_touched` true** (reverting a value doesn't undo the fact the
   user touched the row). Seeded defaults are `false`.

6. **Org scoping & transactions.** Every query is org-scoped via explicit
   `WHERE org_id = $` (these tables aren't RLS-protected — only memberships/
   audit_log/ai_runs are). Hydration and reorder run in a `db.transaction`;
   hydration takes a `FOR UPDATE` row lock and is idempotent on
   `estimateHydratedAt`. `part_materials.org_id` (added in 0021) gives it the same
   scoping handle as `part_operations`.

7. **Server actions: typed-arg RPC returning `{ ok, data } | { ok, error }`.**
   Added to `apps/web/app/[orgSlug]/rfqs/[rfqId]/estimate/actions.ts` (there is no
   `(authenticated)` route group; this is the Reset-Estimate-adjacent file). They
   take a typed object (not FormData) because prompt 3 calls them programmatically,
   and never throw across the boundary (errors → `{ ok:false, error }`).
   `requireAuth()` runs outside the try so its unauthenticated `redirect()` still
   propagates. The legacy FormData/throwing actions in the same file are unchanged.

8. **Test harness.** A Vitest `globalSetup` creates + migrates a dedicated
   `uptool_test` database (overridable via `TEST_DATABASE_URL`); `test.env` points
   the `@uptool/db` singleton at it inside workers. Per-test fixtures create a
   throwaway org and tear it down via cascade. **The services test suite now
   requires a running Postgres** (the local Docker one; CI must provide one).
   PGlite was rejected — it can't slot under the singleton `postgres-js` `db`
   without injecting `db` into every service. Added `postgres` as a services
   devDependency so `global-setup.ts` resolves it.

## Consequences

- 24 tests pass (`pnpm --filter @uptool/services test`), covering happy-path,
  org-scoping rejection, hydration idempotency, `user_touched` flip,
  clear-override-keeps-touched, reorder cross-part rejection, notes semantics,
  quote-bulk write/clear, and Zod rejection.
- No Next.js/React imports in `packages/services` (grep-clean). No UI/component
  file or migration touched in this prompt.
- `partArea` isn't available server-side (parts has no geometry column), so
  `buildDefaultOperations(partArea?)` ignores it — fine, since only the omitted
  Finishing default used it.
- Concurrency is last-write-wins; no optimistic locking (out of scope).
