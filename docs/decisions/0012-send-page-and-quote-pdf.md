# ADR 0012 — Send Page & Quote PDF Generation

## Status

Accepted

## Context

The Send page (`app/[orgSlug]/rfqs/[rfqId]/send`) renders the quote as a PDF
(preview + Print + Download) and will host the email composer (Prompt 9). The
brief mandated `@react-pdf/renderer` for generation, a data-driven org profile,
and full German-market (locale/currency) support. Several points needed a call
the brief left open.

## Decision

1. **New top-level `/send` route; the old `/quote/send` is left intact.** The
   Epic 2 baseline already had a DB-backed `quote/send/page.tsx` (German-string
   email form hitting `quoteService` + `/api/quotes/[id]/pdf`). The brief's
   pixel-perfect Send page is a different surface (client quote state +
   `@react-pdf/renderer`), so it lives at `/send`. The two coexist for now;
   reconciling them is follow-up work once Prompt 9 / real persistence land.

2. **One `usePDF` instance drives preview, Download, and Print.** `usePDF`
   renders the `QuoteDocument` once to a blob URL; the preview is an `<iframe>`
   of that URL, Download is an `<a download>` to it, and Print injects a hidden
   iframe and calls `print()`. The pane is `dynamic(..., { ssr:false })` like the
   estimate file viewers (browser-only). One render, three consumers — and the
   same `QuoteDocument` component is the email attachment in Prompt 9.

3. **Quote state carried via a sessionStorage client store** (`quote-store.ts`),
   mirroring `partCompletion.ts`. "Preview Quote" snapshots the current lines
   (incl. applied variant rows + their lead times/prices), notes, and quote
   number, then navigates. The Send page reads it; reaching `/send` directly
   falls back to `buildDefaultSnapshot` (base lines). This is the single seam to
   swap for Epic 2's `quoteService` DB persistence later.

4. **Quote number is stubbed to the RFQ number.** No new persistence beyond the
   stored number (per brief). Matches the screenshots (RFQ 1194 → Quote 1194).

5. **Org profile is a single stub source** (`org-profile.ts`), values mirroring
   the en-US demo (We Mill You Chill, Letter). Header/footer/T&Cs read only from
   it — Epic 6 wires the real editor by replacing `getOrgProfile`. The logo is a
   monogram placeholder until a real `logoSrc` is supplied.

6. **Locale drives everything formattable** (`quote-i18n.ts`): labels + default
   T&Cs are keyed `en`/`de`; currency/date go through `Intl` from the profile's
   locale + currency (de-* defaults to EUR). No `$`, `NET 30`, or US date format
   is hardcoded — flipping `profile.locale` to `de-DE` renders a German quote.

7. **Multi-page via react-pdf flow.** Header/customer/table render once; the
   numbered T&Cs flow and spill to page 2; the footer (`Page n/total` +
   `Powered by uptool`) is a `fixed` view repeated on every page.

## Addendum — Email composer & send flow

8. **One client owner for the PDF render.** `send-client.tsx` (the `ssr:false`
   target) holds the single `usePDF` instance and renders both the preview pane
   and the composer, so the composer's auto-attachment is literally the same
   rendered blob. `usePDF` reads its `document` once on mount (empty-deps effect),
   so the inline element is safe — no memoization or update loop.

9. **Rich text via `document.execCommand`, no new dependency.** The composer body
   is an uncontrolled `contentEditable` seeded once; the toolbar (B/I/U, link,
   lists, clear, Normal/Heading block format) calls `execCommand`. `execCommand`
   is deprecated but universally supported and needs no library (briefs forbid
   adding libraries unprompted). Swap for a real editor later if richer output is
   needed.

10. **Send is stubbed; the thread is stubbed.** "Send Quote" logs the reply
    payload (recipients + body + attachment blob size) and does not hit Resend —
    real send is a later epic (`quoteService.send`). The original received email
    (`send-stub.ts`) and the reply-from warning are stubbed per the brief; the
    customer email is the one real value (from the resolved RFQ).

11. **Send-stage completion via a sessionStorage flag** (`quote:sent:{rfqId}` in
    `quote-store.ts`), surfaced by `useQuoteSentAt` so the sidebar marks Send ✓
    after sending. Same session-scoped seam as part completion; swap for the DB
    when `quotes.sent_at` is wired.

## Addendum — DIN 5008 restructure (Prompt 11)

12. **The quote document is now DIN 5008 and driven by `quote_template`.** The org
    -profile stub is gone from the Send page; `send/page.tsx` loads
    `quoteTemplateService.get(orgId)` and builds a `DocTemplate` (+ recipient/info
    from the RFQ). `quote-doc.ts` holds the plain data layer (types, snapshot→
    positions, totals, samples); `quote-document.tsx` renders letterhead, sender
    line, recipient + info block, subject, intro, grouped positions (Item 1 →
    1.1/1.2…), Subtotal/VAT/Total (or the §19 note), conditions, contacts, closing,
    T&Cs, and the 4-column legal footer on every page. One `usePDF` instance still
    feeds preview/Download/Print/attachment.

13. **Logos are inlined as data URIs**, not presigned URLs — react-pdf fetches
    image `src` and MinIO presigned URLs are cross-origin (CSP/CORS). The Send page
    and settings load download bytes server-side; the settings form reads uploads
    client-side via `FileReader`.

14. **All document labels come from `quote-i18n.ts` (real en + de)** and all
    numbers/dates/currency from `Intl` keyed off `template.locale`/`currency`.
    Verified: en-US/USD → `$1,234.56` / `05/30/2026`; de-DE/EUR → `1.234,56 €` /
    `30.05.2026`; German labels (Angebotsnr., Zwischensumme, MwSt., Blatt). Switching
    the template locale needs no code change.

15. **Settings live preview** (`template-preview.tsx`, ssr:false) renders the same
    `QuoteDocument` with sample RFQ data and re-renders (debounced) as fields are
    edited.

### Known limitation — "Sheet n/m" in the browser build

The per-page number uses react-pdf's `render`/`fixed` callback. It renders
correctly in the **node `renderToBuffer`** path (isolated test → "Sheet 1 / 1")
but does **not** paint in the **browser `usePDF`** build in `@react-pdf/renderer`
4.5.1, so it's absent from the in-browser preview/Download/attachment. The rest of
the legal footer (the legally-required Pflichtangaben) renders on every page. The
fix is to render the quote PDF **server-side** (`renderToBuffer`) for the real
Download/email attachment in a later step — which also removes the data-URI logo
workaround. Code keeps the canonical pattern so a server path "just works".

## Consequences

- Bundle weight of `@react-pdf/renderer` is isolated to the lazy `/send` chunk
  (route first-load stays ~106 kB).
- Two send routes exist transiently (`/send` and `/quote/send`); the email
  composer (Prompt 9) on `/send` should converge them.
- The stub org profile means the demo shows "We Mill You Chill", not the seeded
  org — intentional until Epic 6.
