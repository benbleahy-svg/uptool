# Verification — Send Quote epic

Date: 2026-06-04 · Branch: `feat/estimating-quoting-pages` · Commit under test: `691c47b`

Runtime verification of the Send Quote flow (DIN-5008 PDF route, Resend send,
status transitions, revision, warning banner). Drove the running app
(`next dev`, Playwright, signed in as `owner@acme.test` via the dev magic link).
Seeded tier line items onto seeded quotes 91092/91093 as a precondition, then
restored the DB to its original seed state.

## Result

| Path | Status | Notes |
|------|--------|-------|
| (a) Two-pane layout, DIN-5008 PDF left + composer right, prefilled To/Subject/Body | ✅ PASS | Draft shows single "Angebot senden"; sent shows green sentAt banner + Re-send + Create-revision. |
| PDF route `/api/quotes/[id]/pdf` | ✅ PASS | `200 application/pdf`, valid `%PDF-`, ~300 ms. Tier math correct (markup + VAT 19% + per-tier totals). Preview == attachment. |
| (c) Warning banner on quote page after send | ✅ PASS | Amber "Dieses Angebot wurde bereits gesendet …" on the sent quote. |
| (e) Revision happy path | ✅ PASS | Single click → counter +1, new draft number, `rfqs.status=quoted`, line items copied, navigates to `/quote`, original sent quote untouched. |
| (f) Resend failure → DB unchanged + error toast | ✅ PASS | Empty `RESEND_API_KEY` routes to the failure branch; toast shown; DB for the draft fully unchanged (send-first-then-persist ordering holds). |
| (b) Successful send → status=sent / sentAt / dashboard pill | ⛔ NOT EXERCISED | `RESEND_API_KEY` empty → success branch unreachable; real send is outward/destructive. Code read (quote.ts:292–302) but not run. |
| (d) Re-send keeps number, updates sentAt | ⛔ NOT EXERCISED | Same blocker as (b). |

## Findings

### Pending fix — revision double-submit (low trigger bar, real corruption)
`doRevision` (send-client.tsx:94) has **no in-flight guard and no confirm dialog**,
unlike the send button (`disabled={sending}` + AlertDialog). A rapid double-click
fires two `createQuoteRevisionAction` POSTs → **two draft quotes created** and
`orgs.quote_counter` **double-incremented**, leaving orphan drafts the RFQ then
picks between arbitrarily. Reproduced live (counter 200 → 202, drafts #201 + #202).

Fix options: add a `revising` pending state disabling the button (mirror the send
button), or make `createQuoteRevision` idempotent.

### Other observations
- **PDF rendered in English** ("Quote No.", "Dear Sir or Madam") while UI + email
  body are German. Locale not threaded into the DIN-5008 doc — likely a gap for a
  DACH product. Confirm intent.
- `doRevision` reuses `t("revision")` for both the button label and the success
  toast (send-client.tsx:97,192) — toast reads like a label, not a confirmation.
- Seeded quotes 91092/91093 carry literal numbers far above `orgs.quote_counter`
  (0), so a first real revision mints number "1". Seed-data artifact, harmless.

## To fully close
1. Add the revision in-flight guard.
2. One live send with a Resend sandbox key (`delivered@resend.dev`) to exercise
   (b) and (d) — the sent-status transition, dashboard pill, and re-send sentAt
   refresh / same-number behavior.
