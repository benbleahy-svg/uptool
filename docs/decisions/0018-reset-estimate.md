# ADR 0018 — Reset Estimate (whole RFQ)

## Status

Accepted

## Context

The estimate toolbar's third icon was a `console.log` stub ("Re-run AI"). It
becomes **Reset estimate** — resets the whole RFQ (every part) to a fresh,
just-imported state.

Key constraint discovered during diagnosis: **the live estimate calculator is
in-memory mock state, not persisted.** Operations/materials/notes and the
override / op-markup / volume-discount / setup-&-runtime-rate fields exist only on
the in-memory `Operation`/`MaterialCard` types (seeded from `mockPart` /
`seedOperations`); they have no DB columns. What *is* persisted and resettable:
`part_operations` rows, `parts.{notesExternal,notesInternal,materialCostCents,
isNoBid,estimateCompletedAt}`, `quotes` + `quote_line_items` (bulk markup /
discount / lead-time variants), and `rfqs.{status,declinedAt,declinedReason}`.
Per-part Completed/No-Bid is also mirrored client-side in `sessionStorage`
(`partCompletion.ts`). The status pill is **derived** (`getRfqStatus`) from stored
`rfqs.status` + `declinedAt` + every part's `isNoBid`.

## Decision

Implement the approved **hybrid (option 3)**: a real DB reset **and** a live
client reset, so it behaves correctly today and is already correct once estimate
persistence lands.

1. **Service (`rfqService.resetEstimate`, `packages/services`, no Next imports):**
   one `withOrgContext` transaction (atomic, all-or-nothing) that, for the RFQ:
   deletes all `part_operations` for its parts; clears
   `parts.{notesExternal,notesInternal,materialCostCents,isNoBid,
   estimateCompletedAt}`; deletes `quotes` (line items cascade); and sets
   `rfqs.status='new'`, `declinedAt=null`, `declinedReason=null`. **Preserves**
   the parts themselves, attachments, AI-extracted fields, `quantityBreaks`, and
   all RFQ/customer metadata. Exposed via the `resetEstimate` server action
   (same auth/org-scoping as adjacent mutations) which `revalidatePath`s the
   estimate/quote/RFQ/dashboard routes.

2. **Client reset:** on confirm, the calculator re-seeds operations from the
   workflow defaults (`seedOperations`), restores the default material card, and
   remounts `NotesSection` (via a bumped `key`) to clear notes — **keeping
   quantities and workflow selection**. It also clears the RFQ's `sessionStorage`
   completion map (`clearCompletion`) so other parts' Completed/No-Bid reset too,
   then `router.refresh()` and toasts. Other parts re-seed fresh on next mount
   (mock) and read the cleared DB rows.

3. **Confirm dialog:** shadcn `AlertDialog` (added to `packages/ui` with
   `@radix-ui/react-alert-dialog`; toast via a `sonner` `Toaster` mounted in the
   root layout, both newly exported from `@uptool/ui`). Title/body/buttons per
   spec; destructive red Reset. **Sent → stronger confirm:** when the derived
   status is `sent`, the dialog shows an extra warning and a required
   acknowledgement checkbox that gates the Reset button. **Declined → normal
   confirm** (reset is the natural "un-decline"). **Per-part No-Bid → cleared.**
   All strings come from the `estimate.reset_*` locale map (en-GB + de); no
   hardcoded JSX strings.

4. **Icon:** lucide `RotateCcw` (circular arrows, matches `reset_estimate.png`),
   keeping the third-icon position; tooltip `estimate.reset_tooltip`.

## Consequences

- The fields with no DB columns (price overrides, op-markup, volume-discount,
  rate selections) are reset on the **client** today; the DB reset already covers
  them structurally once persistence lands (they'll hang off `part_operations`).
- In the mock, "fresh just-imported" = the seeded demo state (`seedOperations`),
  which carries example Setup/Run values. True empty-Setup/Run re-seeding from
  real workflow defaults arrives with the persistence + workflow-seeding work.
- Repurposing the icon removes the (stubbed) "Re-run AI" affordance — out of scope
  here and not wired elsewhere.
- `status` returns to `new` on reset (not "estimated"); the pill derives back to
  Neu. Verified: #1091 estimated→Neu, #1094 all-no-bid declined→Neu, #1092 Cancel
  unchanged, #1093 sent→stronger confirm.
