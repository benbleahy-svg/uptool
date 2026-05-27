# Epic 4 — Status Flow & Estimate Polish

## Goal

Improve the RFQ pipeline with visual status progress indicators, status-transition actions, per-part notes, and operation-type tagging.

## Screenshot references

- `5.01.43 PM` — RFQ table: status shown as segmented progress pills (New / Estimated / Quote Created / Quote Sent)
- `9.55.54 PM` — Close-up status column: "New" rows show inline No-Bid (circle-slash) and Send (arrow) quick-action icons
- `9.58.31 PM` — Estimate operations: dropdown shows "Expense (Operation)" (dollar icon) vs "CNC Milling" (clock icon) operation types
- `4.56.*  PM` — Estimate page: External Notes (prints on quote) + Internal Notes (prints on traveler) per part

---

## Scope

### 4.1 — RFQ status progress bar (table)

Replace the simple text badge in the RFQ table Status column with a segmented progress pill strip. Four segments: **New → Estimated → Quote Created → Quote Sent**. Segments fill solid-blue as the RFQ progresses. Labels appear below the pill strip.

Status → segment mapping:
| RFQ status | Filled segments |
|---|---|
| new | 0 |
| estimated | 1 |
| quoted / quote_created | 2 |
| sent / quote_sent | 3 |
| won | 4 (all, green) |
| lost / no_bid | show "No Bid" or "Lost" text label, grey |

Inline actions visible on hover for "new" rows: `⊘` (No Bid) and `→` (Send quote) icon buttons. Clicking No Bid calls a server action to set status = "no_bid". Clicking Send navigates to `/{orgSlug}/rfqs/{rfqId}/send`.

### 4.2 — Status transition buttons on estimate page

Add two action buttons at the bottom of the estimate tab:
- **Complete** — sets rfq.status = "won"
- **No Bid** — sets rfq.status = "no_bid"

Both call server actions with confirmation (window.confirm before submitting). After action, redirect to `/{orgSlug}/rfqs`.

### 4.3 — Operation type

Add `operationType` column to `part_operations` table: `text("operation_type").notNull().default("machining")`.

Allowed values: `"machining"` | `"expense"`.

In the estimate UI:
- Machining operations show a clock icon (⏱) prefix
- Expense operations show a dollar icon ($) prefix
- The "Add operation" row gets a type toggle/select before the name field

In `CreateOperationInput` add `operationType?: "machining" | "expense"` (default "machining").

### 4.4 — Per-part notes

Add two text columns to `parts`:
- `notesExternal text` — "External Notes" visible to customer, prints on quote PDF
- `notesInternal text` — "Internal Notes" for shop use, prints on traveler (not shown to customer)

On the estimate page, below each part's operations list, show two collapsible note fields with labels "External Notes (printed on quote)" and "Internal Notes (traveler only)". Each saves on blur via a server action `updatePartNotes(partId, notesExternal, notesInternal)`.

In the quote PDF (`quote-pdf.tsx`), include `notesExternal` below each line item if set.

---

## DB changes

1. `ALTER TABLE part_operations ADD COLUMN operation_type text NOT NULL DEFAULT 'machining'`
2. `ALTER TABLE parts ADD COLUMN notes_external text`
3. `ALTER TABLE parts ADD COLUMN notes_internal text`

Generate migration: `pnpm db:generate && pnpm db:migrate`.

---

## i18n keys to add

```json
// estimate namespace additions
"operation_type_machining": "Machining",
"operation_type_expense": "Expense",
"operation_type": "Type",
"notes_external": "External Notes",
"notes_external_hint": "Printed on quote",
"notes_internal": "Internal Notes",
"notes_internal_hint": "Traveler only",

// rfqs namespace additions
"status.won": "Won",
"status.lost": "Lost",
"mark_won": "Mark Won",
"mark_no_bid": "No Bid"
```

---

## Acceptance criteria

1. RFQ table status column shows segmented pill progress for each pipeline stage
2. "New" rows show No-Bid and Send icons on hover; clicking No Bid sets status and refreshes list
3. Estimate page has "Mark Won" and "No Bid" buttons; clicking either updates rfq.status and redirects to list
4. Operations can be tagged as "machining" or "expense"; icon changes accordingly
5. Per-part external and internal notes save on blur; external notes appear in quote PDF
6. `pnpm typecheck && pnpm lint` pass clean
