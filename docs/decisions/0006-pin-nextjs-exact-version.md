# ADR 0006 — Pin Next.js to an exact version and add a `fresh` script

## Status

Accepted

## Context

Next.js uses code-splitting with chunk hashes in filenames. When the installed version drifts from what was used to produce the build cache (e.g. after a `pnpm install` that upgrades a `^`-pinned dependency), the old `.next` cache references chunk files that no longer exist, producing errors like:

```
Error: Cannot find module './2971.js'
```

This is a known class of Next.js cache poisoning that is reproducible whenever:
- The version specifier allows minor or patch updates (`^15.1.3`), and
- pnpm resolves a newer version on a fresh install, and
- a stale `.next` directory remains from the previous version.

## Decision

1. **Pin Next.js to an exact version** (`"next": "15.5.18"` — no caret, no tilde) in `apps/web/package.json`. Upgrades are deliberate: bump the pin, run `pnpm install`, verify the build, commit.

2. **Add `clean` and `fresh` scripts** to the root `package.json`:
   - `pnpm clean` — removes `.next`, `.turbo`, and `dist` directories across the monorepo without touching `node_modules`.
   - `pnpm fresh` — `clean` + `pnpm install` + `pnpm dev`. The recovery command when cache errors occur.

3. **Document `pnpm fresh`** in `README.md` under a Troubleshooting section so any contributor hitting the error can self-serve.

## Consequences

- Next.js will not receive automatic patch updates. The team must bump the pin intentionally and test.
- The recovery path for cache errors is a one-liner (`pnpm fresh`) rather than ad-hoc `rm -rf .next`.
- Turbo's remote cache is unaffected; `pnpm clean` only removes local output directories.
