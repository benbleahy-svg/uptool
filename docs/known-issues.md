# Known Issues

## next build: /404, /500, and /_not-found prerender failure

**Status:** ✅ RESOLVED (June 2026) — fixed by upgrading **Next 15.5.18 → 16.2.7**
and **next-intl 3.26 → 4.13.0** together. `next build` now completes cleanly
(exit 0, all 12 pages generated, `/_not-found` server-rendered on demand with no
prerender error). tsc clean across all 6 packages; `next dev` routing, auth,
i18n, and locale switching all verified working.

### Resolution

Both fixes were required together (neither alone worked — see "Ruled out" below):

- **Next 16** builds with **Turbopack** by default and reworks error-page/export
  handling, clearing the original `<Html> should not be imported` layers.
- **next-intl v4** is the piece that actually fixes the `/_not-found` prerender.
  Under Next 16, next-intl **v3**'s plugin registered the `next-intl/config`
  resolve alias under the now-removed `experimental.turbo` key (Next 16 renamed
  it to top-level `turbopack` and ignores the old one), so prerender of
  `/_not-found` failed with *"Couldn't find next-intl config file."* v4's plugin
  detects Next ≥16 and emits the correct top-level `turbopack.resolveAlias` — no
  manual `next.config.ts` change needed.

The v4 migration was low-touch here: the app uses next-intl only for
translations (`getRequestConfig`, `getTranslations`/`getLocale`/`getMessages`,
`useTranslations`, `NextIntlClientProvider`), **not** its routing/navigation/
middleware APIs, so the breaking v4 routing changes didn't apply. `i18n/request.ts`
already returned `locale` (v4's requirement) and needed no change.

**Deferred (non-blocking):** Next 16 warns that the `middleware` file convention
is deprecated in favour of `proxy`. Our `middleware.ts` is a next-auth middleware
(unrelated to next-intl) and still works — rename to `proxy.ts` is a separate
cleanup. `@sentry/nextjs` 8.x and `react-pdf@7` peer warnings are likewise
pre-existing/out of scope.

---

### Historical diagnosis (pre-fix, kept for context)

**Status was:** OPEN. Pre-existing; not introduced by feature work. `next dev`
was unaffected — only `next build` (production prerender of the internal
error/not-found pages) failed. Tests passed; feature development unblocked.

**Symptom:** `next build` fails on the static-export step with:
  `<Html> should not be imported outside of pages/_document`
  (initially reported on /404 and /500).

### Diagnosis (verified June 2026 — supersedes earlier notes)

This is **two layered problems**, not one, and **next-intl is NOT the
cause** (see below):

- **Layer 1 — pages-router error export.** Next's static export of the
  internal /404 + /500 uses its *built-in* error component
  (`loadDefaultErrorComponents` / `__NEXT_BUILTIN_DOCUMENT__`), which
  renders `<Html>` outside the document context during App-Router export
  and throws. The failing chunk is 100% Next internals.
  - **Fixable** by adding BOTH `apps/web/pages/_document.tsx` AND
    `apps/web/pages/_error.tsx` (plain, no next/document import). A
    custom `_document` ALONE does not help — Next still loads the
    built-in error component unless a custom `_error` exists too.
  - Adding a `pages/` dir flips Next into hybrid mode → `usePathname()`
    / `useSearchParams()` become nullable → null-guards needed in 5 nav
    components (RfqSecondarySidebar, tab-link, settings-nav-link,
    sidebar, language-switcher).

- **Layer 2 — App-Router /_not-found export (exposed once Layer 1 is
  fixed).** `/_not-found` then throws `TypeError: Cannot read properties
  of undefined (reading 'length')` during the **root-layout static
  render**, with a `next/font`-style "`<head>` children need unique keys"
  warning. An explicit `app/not-found.tsx` does NOT clear it (the root
  layout itself breaks). Bisecting is **inconclusive/cascading**:
  removing `next/font` from the root layout doesn't fix /_not-found — it
  moves the failure to `/` with a different webpack error
  (`…reading 'call'`). So the root-layout static-export path
  (next/font + next-intl + providers, on Next 15.5.18) is fragile in
  more than one place at once.

### Ruled out / ineffective

- **next-intl is NOT the cause** — it does not appear in the error-page
  chunk at all (the earlier "prime suspect: withNextIntl" note was
  wrong).
- **next-intl v4.13.0 upgrade** — tsc clean, Next-15/React-19
  compatible, but produces the identical /404 error. Reverted.
- **Next version bump 15.3–15.5** — same failure.
- **No stray `next/document` imports** anywhere in source or deps.

### Recommended fix when prioritised

**Upgrade to Next 16** (reworked error-page / export handling) — highest
probability of resolving both layers at once. It's a major bump, so
validate next-auth (beta), react-pdf v7, next-intl, and the worker
first. The Layer-1 `pages/_document.tsx` + `pages/_error.tsx` + guards
workaround is real but only gets past Layer 1, so it is not worth
landing on its own.
