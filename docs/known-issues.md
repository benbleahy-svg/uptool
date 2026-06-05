# Known Issues

## next build: /404 and /500 prerender failure

**Status:** Pre-existing. Not introduced by any recent feature work.

**Symptom:** `next build` fails with:
  `<Html> should not be imported outside of pages/_document`
  on the /404 and /500 static export step.

**Root cause:** Interaction between next-intl's withNextIntl plugin
and Next.js 15.x's built-in pages-router error page static export
in an App-Router-only project. Reproduces on Next 15.3–15.5 with
no stray next/document imports. Version bump confirmed ineffective.

**Impact:** Production builds fail. Dev server unaffected. All tests
pass. Feature development unblocked.

**Investigated approaches:**
- next/document import audit: clean, not the cause
- Next.js version bump (15.3–15.5): ineffective, same failure
- pages/_document.tsx workaround: confirmed to fix the build but
  introduces hybrid mode requiring null-guards in 5 nav components
- next-intl plugin: prime suspect, not yet confirmed

**Recommended fix when prioritised:** investigate next-intl withNextIntl
config or upgrade to next-intl v4 if compatible. Alternatively apply
the pages/_document.tsx + null-guard fix as a known-safe workaround.
