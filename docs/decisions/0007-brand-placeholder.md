# ADR 0007 — Brand name is a placeholder

**Date:** 2026-05-27  
**Status:** Accepted

## Context

The product needs a working brand name for UI labels, email domains, and forwarding address generation. The final brand identity has not been decided.

## Decision

Use `BRAND` constant exported from `packages/shared/src/brand.ts` as the single source of truth. Current values:

- `name`: `"ToolUp"`
- `domain`: `"toolup.de"`
- `forwardingDomain`: `"in.toolup.de"`

All UI text, `<title>` tags, email addresses, and forwarding address templates reference `BRAND.*` — never a hardcoded string.

## Consequence

Rebranding requires changing one file (`brand.ts`) and no grep-and-replace across the codebase. When the final brand is chosen, update `brand.ts` and run `pnpm build` to propagate everywhere.
