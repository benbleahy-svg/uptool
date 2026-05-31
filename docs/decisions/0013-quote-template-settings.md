# ADR 0013 — Quote Template Settings

## Status

Accepted

## Context

The Quote Template settings page (`settings/quote-template`) captures everything
needed to render a German-standard (DIN 5008) quote, including the legally
required footer (Pflichtangaben). It persists one `quote_templates` row per org
and will feed the quote PDF (Prompt 11). A few choices weren't fixed by the brief.

## Decision

1. **Dedicated locale-keyed strings map, not next-intl.** All UI strings live in
   `settings/quote-template/strings.ts` (`en` + a `de` stub that spreads `en`
   with a few headings translated). The page renders `en` regardless of the app
   locale — the app default is `de`, but the brief wants the UI in English now,
   and localization later is then a pure data change. The settings UI locale is
   independent of the stored quote `locale`/`currency`, which drive the document
   Intl formatting (Prompt 11). The settings nav label was set to "Quote Template"
   in both `messages/*.json` so it reads English under the current de default.

2. **Typed-object save action; FormData only for files.** `saveQuoteTemplate
   (orgSlug, data)` takes the whole template as a serializable object (the form
   is fully controlled), avoiding brittle FormData parsing of nested arrays.
   Logo / footer-logo uploads stay FormData (they carry a `Blob`).

3. **Logo via `storageService` + presigned URL** — the exact pattern the General
   settings logo uses (upload to MinIO under `{orgId}/quote-template/…`, store the
   key, display via `presignedUrl`). This is the established attachment pipeline;
   the key is stored on the template row (`logoUrl`, `footerLogos[]`).

4. **JSONB for repeatables.** `contacts`, `bankAccounts`, `managingDirectors`,
   `footerLogos` are `jsonb` columns (typed via `$type<…>()`). One unique row per
   org (`org_id` unique); `upsert` via `onConflictDoUpdate`, and logo/footer-logo
   have their own setters so a Save never clobbers an uploaded image.

5. **Conditional legal footer by legal form.** Register Court / Number show only
   for register-bearing forms (`eK, GmbH, UG, AG, GmbH_Co_KG, OHG, KG`) and hide
   for `sole_trader, GbR, other`. VAT ID / Tax Number / Jurisdiction always show.

6. **Loose IBAN validation** — inline check (`^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$`),
   shown as a non-blocking field error; Save is never blocked (per "validate
   loosely").

7. **Placeholder T&Cs / terms text** — English boilerplate defaults clearly marked
   as placeholders, not real legal text, per the brief.

## Consequences

- **Migration gotcha:** `drizzle-kit generate` produced `0013_bored_starfox.sql`
  but bundled stale `ALTER TABLE` statements (attachments.part_id, email_messages
  cc/bcc/status) from pre-existing snapshot/DB drift in the repo. Those columns
  already exist, so the SQL was hand-trimmed to only the `quote_templates` table +
  `legal_form` enum. The regenerated snapshot is now correct; future generates
  diff cleanly. Anyone regenerating should expect the same trim.
- The settings UI is English-only until the `de` strings stub is filled in.
- Prompt 11 should source the quote PDF's org identity/footer from
  `quoteTemplateService.get(orgId)` instead of the `org-profile.ts` stub.
