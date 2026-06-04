# 0021 — Parts assembly / sub-assembly hierarchy

Status: Accepted
Date: 2026-06-04

## Context

Epic-2 (`brief/EPIC-2-estimating-quoting.md`) lists **"BOM / sub-assembly cost
roll-up"** under *Out of scope (explicitly)*. Until now `parts` was a flat list;
"Assembly" existed only as a free-text `processType` tag (a yellow pill), not as
a structural relationship.

The user asked to seed assembly + sub-assembly data "so we can see how it looks"
and, when told no hierarchy model existed, chose to **build a real hierarchy
first** rather than fake it in seed data. This ADR records that feature and its
boundaries (it intentionally stops short of the out-of-scope roll-up).

## Decision

1. **Self-referential parent.** Add `parts.parent_part_id` (nullable `uuid`, FK →
   `parts.id`). Top-level part = `NULL`; an *assembly* is simply any part that has
   children; depth is arbitrary (assembly → sub-assembly → leaf). Reuses the
   existing `parts` table — every node is a full part with its own
   operations/materials/estimate.

2. **`ON DELETE SET NULL`** (not `CASCADE`). Deleting an assembly promotes its
   children to top-level rather than silently deleting the sub-tree and its
   estimate data. Non-destructive default; mirrors the set-null FK pattern used
   by `attachments`/`quote_line_items`.

3. **Per-parent quantity.** Add `parts.assembly_quantity` (`integer NOT NULL
   DEFAULT 1`) — the BOM line count of this part within its parent (rendered as a
   `×N` badge). 1 for top-level and single-use children.

4. **Cycle prevention is app-layer, not SQL.** A self-FK can't express "no
   ancestor cycles" in Postgres cheaply. The render helper (`buildPartTree`)
   walks only from roots with a visited-guard, so a cycle cannot loop; any part
   trapped in a cycle is surfaced at the top level so nothing silently
   disappears.

5. **UI = visual nesting only, no cost roll-up.** The estimate parts list
   (`apps/web/app/[orgSlug]/rfqs/[rfqId]/estimate/page.tsx`) renders the flat
   `findByRfq` result as a DFS-ordered tree: depth-based left indent, a `└`
   connector + accent border on nested cards, and the `×N` quantity badge. Each
   part still shows **its own** cost — the roll-up of child cost into the parent
   is the Epic-2 out-of-scope item and is **deferred**.

6. **No "set parent" UI yet.** Hierarchy is created by the seed; there is no
   control to re-parent a part in the UI. Deferred until the feature is needed
   beyond the demo.

7. **Seed uses Title-Case `processType`.** The badge colour map and the add-part
   dropdown use Title-Case values ("Assembly", "CNC Milling", …); the assembly
   demo seed matches them so pills colour correctly (the older lowercase seed
   rows render grey — left untouched).

## Implementation

- **Migration 0023** (`0023_parts_hierarchy.sql` + hand-written
  `.down.sql`): the two columns, the self-FK, and `idx_parts_parent`. Round-trip
  verified (forward → down → forward, no drift).
- **No services change.** `partService.findByRfq` already returns full part rows,
  so `parentPartId`/`assemblyQuantity` flow through automatically; the tree is
  built in the page via `buildPartTree`.
- **Seed** (`packages/db/src/seed-rfq.ts`): idempotent demo **RFQ #1005**
  (domain `assembly-demo.test`) — *Gearbox Assembly* → *Housing Assembly* →
  {Housing Top, Housing Bottom, Gasket ×2}, plus *Gear Set* and *Fastener ×8*
  directly under the gearbox.

## Consequences

- `parent_part_id` is not constrained to the same RFQ at the SQL level; the app
  only ever links parts within one RFQ. A same-RFQ CHECK/trigger could be added
  later if cross-RFQ linking becomes possible via the UI.
- Quote line items remain flat (per ADR 0022); a hierarchy-aware quote is out of
  scope here.
- **Deferred:** cost roll-up, a re-parent UI, and any hierarchy-aware quoting.
