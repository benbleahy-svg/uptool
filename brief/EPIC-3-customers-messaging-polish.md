# Epic 3 — Customers, Messaging & Polish

**Project:** Uptool DACH
**PRD version:** v0.9
**Epic owner:** Product
**Engineer:** Claude Code
**Depends on:** Epic 2 complete and running

---

## Goal

Three things that make the product feel complete for the core quoting loop:

1. **Customers page** — sales team can see all their customers, who their contacts are, and how many open RFQs each has.
2. **Reply from thread** — estimator can reply to the customer's email directly from the thread tab without leaving the app.
3. **Part process type badge** — each part gets a manufacturing process label (Sheet Metal / CNC Milling / etc.) shown as a badge, matching the reference UI.
4. **Attachment categorisation** — files in the thread tab are shown in category tabs (Drawings / CAD / BOM / Other) based on file extension.

---

## Out of scope

- 3D CAD viewer
- Inline PDF split-panel in estimate view
- Workflow templates (Settings → Workflow Templates)
- Quote templates
- Accounting system integration
- RFQ web form
- Revision/versioning of RFQs

---

## 1. Schema additions

### 1.1 Add `process_type` to `parts`

```sql
ALTER TABLE parts ADD COLUMN process_type text;
```

No migration to existing data needed. The field is optional.

**Allowed values (free text, no enum constraint):**
`Sheet Metal`, `CNC Milling`, `CNC Turning`, `3D Printing`, `Fabrication`, `Assembly`, `Other`

Store as free text — the UI offers a dropdown but accepts custom values.

---

## 2. Services additions

### 2.1 `customerService` (`packages/services/src/customer.ts`)

```typescript
customerService.findAll(orgId)         // → list with contact count + last rfq date
customerService.findById(orgId, id)    // → customer + contacts[] + rfqs[] (recent 10)
```

No new DB tables needed — uses existing `customers`, `contacts`, `rfqs`.

### 2.2 `replyService` (`packages/services/src/reply.ts`)

```typescript
replyService.send(orgId, {
  rfqId,
  threadId,
  fromEmail,   // the connected email account address
  toEmail,
  subject,
  bodyText,
}): Promise<{ messageId: string }>
```

Implementation:
- Sends via Resend using `fromEmail` as sender address.
- Inserts a new `email_messages` row (direction = `outbound`, source = `manual`).
- Marks `rfqs.assignee_id` unchanged; does **not** change RFQ status.
- `fromEmail` comes from the org's first active `email_account` or falls back to `RESEND_FROM_EMAIL`.

No new DB tables needed.

---

## 3. Web changes

### 3.1 Customers list page — `/[orgSlug]/customers`

Currently a placeholder. Replace with a real TanStack Table (same pattern as RFQ table):

| Column | Source |
|---|---|
| Company | `customers.name` |
| Domain | `customers.domain` |
| Contacts | count of contacts |
| Open RFQs | count of rfqs where status not in (won, lost, no_bid) |
| Last RFQ | most recent `rfqs.received_at` |

Row click → `/[orgSlug]/customers/[customerId]`

### 3.2 Customer detail page — `/[orgSlug]/customers/[customerId]`

Two sections:
- **Contacts** — table: name, email, add/remove
- **RFQ history** — list of recent RFQs (number, subject, status, received date) linking to the RFQ

### 3.3 Reply composer — thread tab

Below the existing email thread in `[rfqId]/thread/page.tsx`, add a collapsible reply form:

```
[Reply ▸]  (expands on click)
  To:      <contact email, editable>
  Subject: Re: <original subject>, editable
  Body:    <textarea>
  [Send Reply]
```

Server action `sendReply` in `thread/actions.ts`:
- Calls `replyService.send()`
- `revalidatePath` the thread page

The sent reply appears immediately in the thread after reload (it's an `email_messages` row with `direction = outbound`).

### 3.4 Part process type

**Schema field:** `processType` (text, nullable).

**Add-part form** — add a `processType` select/input field after `finish`. Suggested options in the dropdown: `Sheet Metal`, `CNC Milling`, `CNC Turning`, `3D Printing`, `Fabrication`, `Assembly`, `Other`. Also editable as free text.

**Badge in estimate tab** — next to each part's header, render a small coloured badge if `processType` is set:

| Value | Badge colour |
|---|---|
| Sheet Metal | blue |
| CNC Milling | green |
| CNC Turning | teal |
| 3D Printing | purple |
| Fabrication | orange |
| Assembly | yellow |
| other / custom | gray |

### 3.5 Attachment categorisation — thread tab

Above the attachments list, add category filter tabs:

`All` | `Drawings` | `CAD` | `BOM` | `Other`

Categorisation by file extension (case-insensitive):

| Category | Extensions |
|---|---|
| Drawings | `.pdf`, `.dwg`, `.dxf`, `.drw` |
| CAD | `.step`, `.stp`, `.iges`, `.igs`, `.stl`, `.3mf`, `.x_t`, `.x_b`, `.sldprt`, `.sldasm` |
| BOM | `.xlsx`, `.xls`, `.csv` |
| Other | everything else |

Client component — filter state held in `useState`, no server round-trip.

---

## 4. i18n keys to add

```json
"customers": {
  "title": "Kunden",
  "company": "Unternehmen",
  "domain": "Domain",
  "contacts_count": "Kontakte",
  "open_rfqs": "Offene Anfragen",
  "last_rfq": "Letzte Anfrage",
  "no_customers": "Noch keine Kunden.",
  "contacts_title": "Kontakte",
  "rfq_history": "Anfragehistorie",
  "add_contact": "Kontakt hinzufügen",
  "contact_name": "Name",
  "contact_email": "E-Mail"
},
"thread": {
  "reply": "Antworten",
  "reply_to": "An",
  "reply_subject": "Betreff",
  "reply_body": "Nachricht",
  "send_reply": "Antwort senden",
  "attachments_all": "Alle",
  "attachments_drawings": "Zeichnungen",
  "attachments_cad": "CAD",
  "attachments_bom": "Stückliste",
  "attachments_other": "Sonstige"
},
"estimate": {
  // add to existing namespace:
  "process_type": "Fertigungsverfahren"
}
```

---

## 5. Acceptance criteria

| # | Criterion |
|---|---|
| 1 | `/[slug]/customers` shows a sortable table of customers with contact/RFQ counts |
| 2 | Clicking a customer shows their contacts and recent RFQ history |
| 3 | In the thread tab, clicking "Antworten" expands a reply form; submitting it sends the email and inserts an outbound row in the thread |
| 4 | Parts in the estimate tab show a coloured process-type badge when set |
| 5 | Attachments in the thread tab can be filtered by Drawings / CAD / BOM / Other |
| 6 | `pnpm typecheck && pnpm lint` pass clean |
