# Epic 7 — Search, Filters & Quantity Breaks

## Goal

Make the RFQ list usable at scale (search + status filter), let estimators price for the quantities the customer actually requested, and surface unread work with a sidebar badge.

## Scope

### 7.1 — RFQ table: search + status filter

`rfq-table.tsx` is already a client component. Add above the table:

- **Search input**: filters rows whose `customerName` or `subject` contains the typed string (case-insensitive). Debounce not required — filter on every keystroke.
- **Status filter `<select>`**: "All statuses" + one option per status value. Filters to matching rows only.
- **"Mine" toggle**: checkbox that filters to rows where `assigneeId === currentUserId`. Pass `currentUserId` as a prop from the server.

All filtering is client-side — the full data is already loaded. No DB query changes.

### 7.2 — Per-RFQ quantity breaks

**Schema change**: add `quantityBreaks: integer("quantity_breaks").array().notNull().default([1, 10, 100])` to `rfqs`.

When a new RFQ is created (both manual and via email ingest), the default `[1, 10, 100]` is applied automatically.

**Edit UI**: on the RFQ detail layout header (right side, below the assignee picker), add a small `QuantityBreaksEditor` client component:
- Displays current breaks as a comma-separated string: `1, 10, 100`
- On blur of the input, submits a form to `updateQuantityBreaks` server action
- Server action parses comma-separated ints, deduplicates, sorts ascending, saves to DB

**Estimate page**: replace `DEFAULT_QUANTITY_BREAKS` usage with `rfq.quantityBreaks`. The `findById` query in `rfqService` already returns the rfq with all columns, so no join needed. The estimate page already fetches the rfq; just use `rfq.quantityBreaks` instead.

**`partService.findByRfq`** doesn't need to change — the quantities are passed at render time.

### 7.3 — New RFQ badge on sidebar

In `org layout.tsx`:
- Count RFQs with `status = 'new'` for the org using a simple `db.query` count
- Pass `newRfqCount: number` to `Sidebar`

In `sidebar.tsx`:
- Add `newRfqCount?: number` to `SidebarProps`
- On the RFQs nav item, when `newRfqCount > 0`, show a small badge: rounded pill, blue fill, white text, shows the count. Visible even when sidebar is collapsed (positioned over the icon).

### 7.4 — i18n keys

```json
// rfqs namespace additions
"search_placeholder": "Search…",
"filter_all_statuses": "All statuses",
"filter_mine": "Mine",
"quantity_breaks": "Quantities",
"quantity_breaks_hint": "e.g. 1, 10, 100",
"save_quantities": "Save"
```

---

## DB changes

Migration: `ALTER TABLE rfqs ADD COLUMN quantity_breaks integer[] NOT NULL DEFAULT ARRAY[1,10,100]`.

---

## Acceptance criteria

1. RFQ table: typing in search box filters rows immediately; status dropdown filters by status; "Mine" shows only assigned rows
2. Estimate page columns reflect the rfq's quantity breaks (not hardcoded [1,10,100])
3. Editing quantity breaks in the RFQ header and blurring saves to DB; estimate recalculates
4. Sidebar shows badge count of "new" RFQs; badge disappears when all are actioned
5. `pnpm typecheck && pnpm lint` pass clean
