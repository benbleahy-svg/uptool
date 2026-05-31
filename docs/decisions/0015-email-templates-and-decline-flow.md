# ADR 0015 — Email Templates settings + decline follow-up flow

## Status

Accepted

## Context

After Prompt A made "Declined" a real, settable RFQ state, we need a customer-facing
decline notice. Two requirements: (1) an editable, per-org decline email template
held in the settings area, and (2) a follow-up flow that pre-drafts that template
into the Messaging composer and sends only after explicit human confirmation. Real
email delivery is still stubbed.

## Decision

1. **`email_templates` is one row per org with a jsonb `templates` map**, keyed by
   template type (migration `0016`). Only `"decline"` is wired up, but the map +
   the `EmailTemplateKey` union let us add quote-cover / follow-up templates later
   with no migration. `emailTemplateService.resolve(orgId)` merges stored entries
   over `DEFAULT_EMAIL_TEMPLATES` so callers always get usable copy; `upsert` is the
   onConflictDoUpdate per-org pattern from `quote_templates`.

2. **Defaults live in the service, UI chrome in a locale-keyed `strings.ts`** — the
   split mirrors the quote template. `DEFAULT_EMAIL_TEMPLATES` (English, polite
   placeholder — explicitly not legal language) is reused by both the settings form
   and the messaging draft, so there's one source of default copy. The settings page
   renders English now; the `de` stub keeps localization a data-only change.

3. **Settings page replicates the quote-template shape**: server page loads
   `resolve()`, a client form (`EmailTemplatesForm`) edits subject/body with a token
   hint, Save (`saveEmailTemplates(orgSlug, data)` typed object) + Reset-to-loaded.
   The form renders a `SECTIONS` registry (one entry: decline) so adding a template
   type is a one-line change. Nav item added to the settings layout + `de`/`en-GB`
   messages.

4. **Tokens** (`{rfqNumber}`, `{companyName}`, `{contactName}`) are substituted by a
   pure `renderTokens()` helper (`lib/email-tokens.ts`). `tokensFromRfq()` supplies
   polite fallbacks ("Sir or Madam", "your company") so a token never renders empty
   in a customer draft; unknown tokens are left intact so typos are visible.

5. **One draft+confirm flow, two entry points, driven by `?draft=decline`** on the
   Messaging route. The route resolves the decline template, substitutes tokens, and
   derives recipients from the thread (last inbound sender, falling back to the RFQ
   contact — like the Send page), then hands the `MessagingPage` composer a
   `declineDraft`. Arriving with a draft pre-fills the (now editable) To/Subject/Body
   and auto-opens a "Send decline notice?" confirm modal.
   - **Path A — explicit decline:** the overview "No Bid RFQ" button and the dashboard
     kebab "Decline" both call `declineRfq` (Prompt A) and then `router.push` to
     `…/messaging?draft=decline`.
   - **Path B — all-parts-no-bid:** nothing auto-routes or auto-drafts. The overview
     shows a non-blocking "Notify customer of decline" button (when the derived status
     is Declined) that links to the same `?draft=decline` URL — the user opts in.

6. **Send stays stubbed; nothing sends without confirm.** The composer's confirm
   button assembles the exact payload (`to/cc/bcc/subject/bodyText` + rfq context)
   and `console.log`s it, then shows a "sent (stubbed — not delivered)" note. Cancel
   closes the modal and leaves the draft editable. We deliberately did **not** route
   through `thread/sendReply` (which is live Resend) — the prompt requires a stubbed
   path that logs the payload.

## Consequences

- The Messaging composer's To/Subject became editable controlled fields (they were
  disabled stubs). The To field is a minimal chip editor (add on Enter/comma, remove
  per chip). Cc/Bcc remain TODO but are carried as empty arrays in the payload for
  forward-compatibility.
- Both decline entry points now leave their current page and land on the RFQ's
  Messaging page — an intentional context switch matching "explicit decline → route
  to Messaging."
- The decline draft reads default copy from the service. If an org customizes the
  template in settings, both the settings form and the messaging draft reflect it via
  `resolve()` — one source of truth.
- Real send is still not wired. When it lands, replace the `confirmSend` console.log
  with the actual send + `replyService.recordOutbound` (the payload shape already
  matches what that path needs).
