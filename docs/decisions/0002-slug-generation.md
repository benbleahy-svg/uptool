# 0002 — Slug generation algorithm

**Date:** 2026-05-27

## Context

Org slugs appear in URLs (`/{slug}/rfqs`) and must be URL-safe, human-readable, and unique. The brief specified that slugs are generated from the org name but didn't define the algorithm.

## Decision

Algorithm (implemented in `packages/shared/src/slugs.ts`):
1. Lowercase the name
2. Trim whitespace
3. Strip all characters except `a-z`, `0-9`, spaces, and hyphens
4. Replace runs of whitespace with a single hyphen
5. Collapse multiple hyphens into one
6. Remove leading/trailing hyphens
7. Truncate to 48 characters

On collision, append `-2`, `-3`, ... up to `-99`. If all are taken, throw.

No external library (slugify, etc.) — the logic is simple enough to own.

## Consequences

- Slugs are stable for a given name: "Acme GmbH" always produces "acme-gmbh"
- Non-ASCII characters (umlauts, etc.) are stripped rather than transliterated — an org named "Müller GmbH" produces "mller-gmbh", which looks odd. Acceptable for MVP; can add transliteration (ü→ue, ä→ae, ö→oe) in a later epic
- Reserved slugs (`api`, `admin`, etc.) are blocked at generation time
