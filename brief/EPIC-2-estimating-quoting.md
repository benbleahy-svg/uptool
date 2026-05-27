# Epic 2 — Estimating & Quoting

**Project:** Uptool DACH
**PRD version:** v0.9
**Epic owner:** Product
**Engineer:** Claude Code
**Depends on:** Epic 1 complete and running

---

## Goal

An estimator opens an RFQ (received via email or created manually), adds parts, enters operations with setup/run times and hourly rates, views computed costs at multiple quantity breaks (1 / 10 / 100), sets markup and lead time to build a quote, generates a PDF, and sends it to the customer via email. End state: the full quote-to-send loop works end-to-end.

---

## Out of scope (explicitly)

- 3D CAD viewer (Epic 4)
- Formula-based / parametric operations
- BOM / sub-assembly cost roll-up
- Multiple quote revisions per RFQ
- Customer portal (quoting portal the customer sees)
- QuickBooks / ERP integration
- Automated cost updates when operations change (manual recalculate is fine)
- Machine capacity scheduling

---

## 1. Stack additions for Epic 2

| Addition | Choice | Notes |
|---|---|---|
| PDF generation | `@react-pdf/renderer` | Server-side React-to-PDF; no puppeteer |
| Email send | Resend (already installed) | Attach PDF as base64 |

No new heavy dependencies beyond these two.

---

## 2. Database schema additions

### 2.1 Add `quote_counter` to `orgs`

```sql
ALTER TABLE orgs ADD COLUMN quote_counter integer NOT NULL DEFAULT 0;
```

### 2.2 `parts`

One row per part (drawing) per RFQ.

```sql
CREATE TABLE parts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  rfq_id        uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  part_number   text,
  revision      text,
  description   text,
  material      text,
  finish        text,
  material_cost_cents  integer NOT NULL DEFAULT 0,  -- raw material cost per unit, in cents
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parts_rfq ON parts(rfq_id);
```

RLS: `org_id = current_setting('app.org_id')::uuid`.

### 2.3 `part_operations`

Each operation row represents one manufacturing step on a part.

```sql
CREATE TABLE part_operations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  part_id          uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  name             text NOT NULL,
  setup_minutes    numeric NOT NULL DEFAULT 0,  -- one-time per batch
  run_minutes      numeric NOT NULL DEFAULT 0,  -- per unit
  hourly_rate_cents integer NOT NULL DEFAULT 0, -- cents per hour (avoids float rounding)
  is_non_recurring boolean NOT NULL DEFAULT false,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_part_operations_part ON part_operations(part_id);
```

**Cost formula for a single operation at a given quantity `q`:**
```
setup_cost     = setup_minutes / 60 * hourly_rate_cents      (one-time)
run_cost_total = run_minutes / 60 * hourly_rate_cents * q    (per-unit × qty)
total_cost     = setup_cost + run_cost_total
cost_per_unit  = total_cost / q
```

### 2.4 `quotes`

```sql
CREATE TABLE quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  rfq_id              uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  quote_number        integer NOT NULL,
  status              text NOT NULL DEFAULT 'draft',  -- 'draft' | 'sent'
  notes_for_customer  text,
  sent_at             timestamptz,
  created_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotes_rfq ON quotes(rfq_id);
```

### 2.5 `quote_line_items`

One row per part × quantity break.

```sql
CREATE TABLE quote_line_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  quote_id              uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  part_id               uuid REFERENCES parts(id) ON DELETE SET NULL,
  quantity              integer NOT NULL,
  cost_per_unit_cents   integer NOT NULL DEFAULT 0,
  markup_pct            numeric NOT NULL DEFAULT 30,
  quote_unit_price_cents integer,  -- null = unset (use computed = cost * (1 + markup/100))
  lead_time_weeks       integer,
  is_no_bid             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);
```

---

## 3. Default quantity breaks

Default quantity breaks are `[1, 10, 100]`. These are hardcoded constants for now — a future epic can make them configurable per org.

---

## 4. Cost calculation

All monetary values stored as integer cents to avoid float precision issues.

The `estimateService.computeCosts(partId, quantities)` function:
1. Fetches the part (material_cost_cents)
2. Fetches all `part_operations` for the part
3. For each quantity in `quantities`:
   - Sums operation costs using the formula in §2.3
   - Adds `material_cost_cents`
   - Returns `{ quantity, cost_per_unit_cents: total }`
4. Returns array sorted by quantity

---

## 5. Quote workflow

1. From the RFQ detail page, estimator clicks **Estimate** tab → sees parts list
2. Estimator adds parts, sets material, adds operations with time/rates
3. The estimate cost preview auto-computes (server action or client calculation)
4. Estimator clicks **Quote** tab → quote builder
5. Quote builder shows each part × each quantity break as a row:
   - Cost per unit (computed, read-only)
   - Markup % (editable, default 30%)
   - Quote unit price (computed = cost × (1 + markup/100), overrideable)
   - Lead time in weeks (editable)
   - No-bid toggle
6. "Create Quote" saves quote + line items to DB, increments quote_counter
7. "Download PDF" hits `/api/quotes/[quoteId]/pdf` which returns `application/pdf`
8. **Send** tab: email composer with PDF pre-attached, sends via Resend

---

## 6. RFQ detail page restructure

The current single-page layout needs tab navigation. Use Next.js layout + child pages:

```
/[orgSlug]/rfqs/[rfqId]/
  layout.tsx            — header (rfq#, customer, status badge) + tab nav
  page.tsx              — redirect to /thread
  thread/page.tsx       — existing email thread + metadata panel
  estimate/page.tsx     — parts list + estimating UI
  quote/page.tsx        — quote builder
  quote/send/page.tsx   — email send
```

Tab labels (DE): Nachrichten | Kalkulation | Angebot | Senden
Tab labels (EN-GB): Messages | Estimate | Quote | Send

---

## 7. Estimate tab UI

- Parts list (sorted by sort_order)
- Each part: expandable card showing operations table
- Operations table columns: Operation name | Setup (min) | Run (min/unit) | Rate (€/h) | Non-recurring? | Cost @ qty 1 | Cost @ qty 10 | Cost @ qty 100
- "Add Operation" button opens inline row editor
- "Add Part" button opens a modal/drawer with fields: Part #, Revision, Description, Material, Finish, Material cost (€ per unit)
- Status RFQ → "estimated" when at least one part has at least one operation

---

## 8. Quote tab UI

- "Create / Update Quote" button at top (idempotent — updates existing draft if one exists)
- Line items table: Part description | Qty | Cost/unit | Markup % | Quote price/unit | Lead time | No-bid
- Totals row at bottom
- "Download PDF" button → calls `/api/quotes/[quoteId]/pdf`
- Notes for customer textarea

---

## 9. Quote PDF

Route: `GET /api/quotes/[quoteId]/pdf`

PDF sections:
1. Header: org name + logo placeholder, quote number, date, customer info
2. Line items table (part, qty, unit price, total)
3. Notes for customer
4. Footer: validity (30 days), contact email

Use `@react-pdf/renderer`. Styles match the app's existing design system (clean, minimal).

---

## 10. Send tab UI

- Shows PDF preview (iframe loading `/api/quotes/[quoteId]/pdf`)
- To: field (pre-filled from RFQ contact email, editable)
- Subject: pre-filled "Quote #{quoteNumber} — {rfqSubject}"
- Body: rich-text (textarea, not full editor — keep it simple)
- "Send" button → server action → Resend API → marks quote as `sent`, sets `sent_at`

---

## 11. Services layer rules

- `partService`, `estimateService`, `quoteService` — no Next.js imports
- All services accept `orgId` and use `withOrgContext`
- `quoteService.send` calls Resend SDK directly (OK per services layer rules — Resend is not a Next.js dep)

---

## 12. i18n keys needed

```json
"estimate": {
  "tab": "Kalkulation",
  "add_part": "Teil hinzufügen",
  "part_number": "Teilenummer",
  "revision": "Revision",
  "description": "Beschreibung",
  "material": "Material",
  "finish": "Oberfläche",
  "material_cost": "Materialkosten (€/Stück)",
  "operations": "Arbeitsgänge",
  "add_operation": "Arbeitsgang hinzufügen",
  "operation_name": "Bezeichnung",
  "setup_min": "Rüstzeit (min)",
  "run_min": "Laufzeit (min/Stk)",
  "hourly_rate": "Stundensatz (€/h)",
  "non_recurring": "Einmalig",
  "cost_at_qty": "Kosten bei {qty} Stk",
  "no_parts": "Noch keine Teile. Teile hinzufügen um zu kalkulieren."
},
"quote": {
  "tab": "Angebot",
  "create": "Angebot erstellen",
  "update": "Angebot aktualisieren",
  "download_pdf": "PDF herunterladen",
  "markup_pct": "Aufschlag %",
  "lead_time_weeks": "Lieferzeit (Wo.)",
  "no_bid": "Kein Angebot",
  "notes_for_customer": "Kundennotizen",
  "cost_per_unit": "Kosten/Stk",
  "quote_price": "Angebotspreis/Stk",
  "no_quote": "Noch kein Angebot. Kalkulation abschließen und dann Angebot erstellen."
},
"send": {
  "tab": "Senden",
  "to": "An",
  "subject": "Betreff",
  "body": "Nachricht",
  "send_quote": "Angebot senden",
  "sent_at": "Gesendet am {date}",
  "no_quote_to_send": "Angebot zuerst erstellen."
}
```

---

## 13. Acceptance criteria

| AC | Verify |
|---|---|
| 1 — Add part | Estimator adds part with material cost, sees it in parts list |
| 2 — Add operation | Estimator adds "CNC Milling" op with 30 min setup, 15 min/unit run, €120/h rate; at qty 1 cost = (0.5 + 0.25) × 120 = €90; at qty 10 cost = (0.5 + 2.5) × 120 / 10 = €36 |
| 3 — Quote draft | "Create Quote" saves line items; page shows cost + markup columns |
| 4 — PDF download | GET /api/quotes/[id]/pdf returns `application/pdf` with correct content |
| 5 — Send | Clicking "Send" calls Resend; quote marked `sent` in DB; RFQ status updated to `quoted` |
| 6 — Manual RFQ | User can create RFQ without email (form: customer email, subject) |
| 7 — typecheck | `pnpm typecheck` passes 6/6 |
| 8 — lint | `pnpm lint` 0 errors |
