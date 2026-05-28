# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

# Uptool DACH

AI-powered quoting platform for high-mix, low-volume (HMLV) manufacturing shops in Germany.

## Working with this repo

- Briefs for each epic live in `brief/`. Read the relevant brief before starting work.
- Decisions live in `docs/decisions/` as numbered ADRs. Create a new ADR whenever you make a choice not specified in a brief.
- Reference materials (screenshots of the product we're cloning, notes) live in `assets/`.
- Stack and conventions are pinned in the briefs — do not deviate without raising it first.

## Current epic

Epic 0 — Foundation. See `brief/epic-0-foundation.md`.

## Style

- Ask clarifying questions before writing code. Don't guess.
- Log non-obvious decisions in `docs/decisions/`.
- Don't introduce libraries the briefs forbid. If something feels missing, ask.

# Reference material
- Screenshot of desired UI: @assets/screenshot...
- Similar product for reference: https://uptool.com/product (we are building a DACH region version of this)

---

## Commands

```bash
# Local dev startup (first time)
docker-compose up -d && pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev

# Daily dev
pnpm dev          # runs web + worker concurrently via Turborepo
pnpm build        # build all packages

# Code quality
pnpm typecheck    # tsc --noEmit across all packages
pnpm lint         # Biome lint
pnpm format       # Biome format
pnpm test         # Vitest

# Database
pnpm db:migrate   # run Drizzle migrations
pnpm db:seed      # seed: Acme GmbH org (slug `acme`), user owner@acme.test
pnpm db:studio    # Drizzle Studio GUI
```

Linting and formatting use **Biome** only — no ESLint, no Prettier.

---

## Architecture

### Monorepo layout

```
apps/web/       Next.js 15 App Router — UI only, thin server actions
apps/worker/    Node BullMQ worker — background jobs
packages/db/    Drizzle schema, migrations, client
packages/shared/  Zod schemas, types, constants (no framework deps)
packages/services/  Business logic — imported by both web and worker
packages/ui/    shadcn/ui components shared between apps
docs/decisions/ ADRs (numbered MD files) — log every non-brief decision here
```

Path aliases: `@uptool/db`, `@uptool/shared`, `@uptool/services`, `@uptool/ui` — defined in `tsconfig.base.json`.

### Services layer (critical convention)

All business logic lives in `packages/services/`. Services receive plain inputs, return plain data, and **must not** import from `next/*`, `next-auth/*`, or `react`. CI enforces this with a grep check.

Server actions in `apps/web/` are thin wrappers: call `requireAuth()`, pass data to a service, then call `revalidatePath()`. Never put business logic in server actions.

### Multi-tenancy

Every authenticated request sets `SET LOCAL app.org_id = '<uuid>'` in Postgres. Drizzle's `withOrgContext` helper wraps all queries. Row-Level Security policies on `memberships`, `audit_log`, and `ai_runs` enforce tenant isolation at the database level.

Routing: all tenant routes are `/{org-slug}/*`. Middleware validates slug exists, user has membership, and sets `orgId`/`orgSlug` headers.

Reserved slugs (cannot be used as org names): `api`, `signin`, `signup`, `onboarding`, `legal`, `health`, `_next`, `static`, `images`, `public`, `admin`, `docs`, `help`, `support`, `pricing`, `about`, `terms`, `privacy`.

### Auth flow

Magic link (Resend) + Google OAuth + Microsoft OAuth (`common` tenant) via Auth.js v5. Sessions are JWT (not DB sessions), containing `userId`, `defaultOrgId`, `defaultOrgSlug`, `locale`. New users with no memberships land on `/onboarding/new-org`.

### i18n

Locales: `de` (primary) and `en-GB`. Uses `next-intl`. Locale resolution order: `?locale=` param → user record → org default → `Accept-Language` header → `de`. Number format: DE uses `1.234,56 €` / `26.05.2026`; EN-GB uses `1,234.56 €` / `26/05/2026`.

## After running `pnpm build`
Always run `rm -rf apps/web/.next` afterwards to clear prod artifacts
before the dev server restarts. This prevents module-not-found errors
from stale chunk references.
