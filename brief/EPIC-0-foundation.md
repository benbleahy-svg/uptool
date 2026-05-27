# Epic 0 — Foundation

**Project:** Uptool DACH
**PRD version:** v0.8
**Epic owner:** Product
**Engineer:** Claude Code
**Time estimate:** 1 full Claude Code session (2–4 hours of agent work + iteration)

---

## Goal

Stand up the Uptool DACH codebase. End state: a Next.js app with Postgres + Drizzle + Row-Level Security, Auth.js v5 with email + Google + Microsoft, path-based multi-tenant routing, EN-GB / DE i18n, Tailwind + shadcn/ui, BullMQ worker scaffold, Sentry wired up. A user can sign up, create an org, switch language, and see an empty (stubbed) dashboard at `/{org-slug}/rfqs`. **Local dev only — no deployment in this epic.**

## Out of scope (explicitly)

- Email ingestion (Epic 1)
- RFQ list table with real data (Epic 1)
- CAD viewer (Epic 4)
- AI extraction (Epic 3)
- File upload (Epic 2)
- Any business feature beyond org creation

---

## How to use this brief with Claude Code

1. Paste this entire document as your first message to a fresh Claude Code session.
2. Tell the agent: "Please read this brief in full before doing anything. Then ask me any clarifying questions before writing code."
3. Work through the phases in order. Acceptance criteria at §12 must all pass before the epic is complete.
4. When the agent makes a decision not specified here, it must log it in `docs/decisions/` as a numbered ADR.
5. If a session gets long, summarise progress and start a fresh session pointing the new agent at the existing repo + this brief + a "what's been done" note.

---

## 1. Stack (pinned — do not deviate)

| Layer | Choice | Version pin |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Package manager | pnpm | 9.x |
| Frontend framework | Next.js App Router | 15.x |
| Language | TypeScript | 5.6+ |
| Database | Postgres | 16 (docker locally) |
| ORM | Drizzle | latest |
| Auth | Auth.js | v5 (`next-auth@beta`) |
| Styling | Tailwind | 4.x |
| Component library | shadcn/ui | latest (CLI install per component) |
| i18n | next-intl | latest |
| Queue | BullMQ | latest |
| Cache/queue backend | Redis | 7 (docker locally) |
| Observability | Sentry | latest |
| Test runner | Vitest | latest |
| E2E (later epics) | Playwright | latest |
| Linter / formatter | Biome | latest (no ESLint + Prettier — Biome handles both) |
| Monorepo task runner | Turborepo | latest |
| Email (magic links) | Resend | latest |

**Do not introduce:** Prisma, Clerk, WorkOS, NextAuth v4, styled-components, MUI, Chakra, Vite, Express, Redux, ESLint, Prettier. If any of those feel like the answer, you've taken a wrong turn — stop and ask.

---

## 2. Repo structure

```
uptool/
├── apps/
│   ├── web/                    # Next.js app
│   └── worker/                 # Node worker (BullMQ — scaffold only this epic)
├── packages/
│   ├── db/                     # Drizzle schema, migrations, client
│   ├── shared/                 # Types, Zod schemas, constants
│   ├── services/               # Business logic — non-negotiable layer (see §3.5)
│   └── ui/                     # shadcn/ui components (if shared between apps)
├── docs/
│   ├── decisions/              # ADRs — numbered MD files
│   ├── runbooks/               # ops procedures (placeholder)
│   └── PRD.md                  # paste v0.8 here for reference
├── docker-compose.yml          # postgres + redis for local dev
├── .env.example                # template; never commit real .env
├── biome.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── package.json
```

**Conventions:**
- Every package has its own `package.json` and `tsconfig.json`.
- TypeScript path aliases via `tsconfig.base.json`: `@uptool/db`, `@uptool/shared`, `@uptool/services`, `@uptool/ui`.
- No circular deps between packages. `apps/*` depend on `packages/*`, never the reverse.
- `packages/services/` cannot import from `next/*`, `next-auth/*`, or `react`.

---

## 3. Database — schema & RLS

### 3.1 Tables for Epic 0

Create migrations for these tables only. Other tables come in later epics.

```sql
-- orgs: the tenant
create table orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  country       text not null,                  -- 'DE' | 'AT' | 'CH'
  locale_default text not null default 'de',    -- 'de' | 'en-GB'
  timezone      text not null default 'Europe/Berlin',
  vat_id        text,
  handelsregister_nr text,
  address_jsonb jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- users: people who can log in
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  locale        text not null default 'de',
  image_url     text,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- memberships: user ↔ org with role
create type membership_role as enum ('owner', 'estimator', 'office');

create table memberships (
  org_id        uuid not null references orgs(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          membership_role not null,
  created_at    timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- audit_log: append-only history
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  entity        text not null,
  entity_id     uuid,
  action        text not null,
  diff_jsonb    jsonb,
  occurred_at   timestamptz not null default now()
);

-- ai_runs: every AI call is logged here
create table ai_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  model         text not null,
  prompt_version text not null,
  input_hash    text not null,
  output_jsonb  jsonb,
  latency_ms    integer,
  cost_usd      numeric(10, 6),
  created_at    timestamptz not null default now()
);

-- Auth.js v5 required tables (accounts, sessions, verificationTokens)
-- Use the Drizzle adapter's schema and add them to migrations.
```

### 3.2 Indexes

```sql
create index idx_memberships_user on memberships(user_id);
create index idx_audit_log_org_entity on audit_log(org_id, entity, entity_id);
create index idx_ai_runs_org_created on ai_runs(org_id, created_at desc);
```

### 3.3 Row-Level Security — critical

This is the foundation of multi-tenancy. **Get this right or every later epic builds on sand.**

Enable RLS on every tenant-scoped table:

```sql
alter table memberships enable row level security;
alter table audit_log enable row level security;
alter table ai_runs enable row level security;
-- orgs and users are NOT RLS-scoped by org_id — they're accessed via
-- membership checks done at the app layer.

-- Policy pattern: every tenant-scoped table gets this policy.
create policy tenant_isolation on audit_log
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

-- Same for memberships and ai_runs.
```

### 3.4 Setting the session variable

Every authenticated request must execute:

```sql
set local app.org_id = '<org-uuid>';
```

Inside the transaction that runs the user's query. Implementation pattern:

```typescript
// packages/db/src/with-org-context.ts
export async function withOrgContext<T>(
  orgId: string,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local app.org_id = ${orgId}`);
    return fn(tx);
  });
}
```

Every server action and route handler that touches tenant data must use `withOrgContext`. There is **no escape hatch** — even admin operations get their own role (covered in a later epic).

### 3.5 Services layer convention (non-negotiable)

All business logic lives in `packages/services/`. The pattern:

```typescript
// packages/services/src/org.ts
import { withOrgContext } from "@uptool/db";

export const orgService = {
  async create({ userId, name, country, locale }: CreateOrgInput) {
    // Org creation uses an admin role since the user has no membership yet.
    // (Admin role setup is covered in a later epic; for now use a direct
    // db.transaction without withOrgContext since RLS doesn't apply to orgs.)
    return db.transaction(async (tx) => {
      const [org] = await tx.insert(orgs).values({
        name,
        slug: generateSlug(name),
        country,
        locale_default: locale,
      }).returning();
      await tx.insert(memberships).values({
        org_id: org.id,
        user_id: userId,
        role: 'owner',
      });
      return org;
    });
  },
};

// apps/web/app/onboarding/new-org/actions.ts
"use server";
import { orgService } from "@uptool/services";
import { requireAuth } from "@/lib/auth";

export async function createOrgAction(input: CreateOrgInput) {
  const { userId } = await requireAuth();
  const org = await orgService.create({ userId, ...input });
  revalidatePath(`/${org.slug}/rfqs`);
  return org;
}
```

**Rules:**
- Services accept `{ orgId, userId, ... }` as plain inputs; never read auth state directly.
- Services return plain data structures; no `redirect()`, no `revalidatePath()`, no Next.js framework calls.
- Server actions are thin: auth check, call service, return result, optional `revalidatePath`.
- All services use `withOrgContext` for tenant-scoped DB calls.
- Input/output types live in `packages/shared/` as Zod schemas. Services consume `z.infer<typeof Schema>` types.
- CI enforces that `packages/services/` does not import from `next/*`, `next-auth/*`, or `react`.

**Why:** this is how we ship a public API in v1.1 without rewriting. Don't violate this.

### 3.6 Migrations

- Use `drizzle-kit` with `dialect: 'postgresql'`.
- Migrations live in `packages/db/migrations/`.
- Migration filenames are timestamp-prefixed.
- Each migration includes both the auto-generated SQL diff and explicit RLS policy creation where applicable.
- Write a `pnpm db:migrate` script that runs all pending migrations.
- Write a `pnpm db:seed` script that creates:
  - 1 test org "Acme GmbH" (slug `acme`)
  - 1 user (`owner@acme.test`)
  - 1 membership (owner)

### 3.7 Type generation

Drizzle generates types automatically from the schema. Export them from `packages/db/src/schema.ts`. App code imports types only from `@uptool/db`, never re-defines them.

---

## 4. Auth.js v5 setup

### 4.1 Providers
- Email magic link (via Resend)
- Google OAuth
- Microsoft OAuth (with `common` tenant — supports both personal and work accounts)

### 4.2 Adapter
- Use the **Drizzle adapter** for Auth.js. Required tables (`accounts`, `sessions`, `verificationTokens`) live in the same schema as our app tables.

### 4.3 Session strategy
- **JWT sessions** (not database sessions) for performance.
- JWT payload includes: `userId`, `defaultOrgId`, `defaultOrgSlug`, `locale`.
- The current org is resolved per-request from the URL path (see §5), not from the JWT — JWT only stores the user's default org for landing redirects.

### 4.4 Sign-up flow
- First-time email magic link or OAuth callback creates a user row.
- If the user has no memberships, redirect to `/onboarding/new-org`.
- `/onboarding/new-org` form: org name (required), country (DE/AT/CH dropdown), default locale (DE/EN-GB).
- On submit: call `orgService.create()`, redirect to `/{slug}/rfqs`.

### 4.5 Sign-in flow
- If the user has memberships, redirect to `/{default-org-slug}/rfqs` (their first membership's org).

### 4.6 Sign-out
- Standard Auth.js sign-out, returns to `/`.

### 4.7 Protected routes
- All routes under `/{slug}/*` require authentication AND membership in the org matching `{slug}`. Middleware enforces both.
- Membership check is one query per request, cached in middleware for the duration of the request.

---

## 5. Path-based multi-tenant routing

### 5.1 URL shape
- Public: `/`, `/signin`, `/signup`, `/onboarding/new-org`, `/legal/*`
- Tenant-scoped: `/{slug}/rfqs`, `/{slug}/rfqs/{id}`, `/{slug}/customers`, `/{slug}/settings/*`

### 5.2 Reserved slugs (cannot be used as org slugs)
`api`, `signin`, `signup`, `onboarding`, `legal`, `health`, `_next`, `static`, `images`, `public`, `admin`, `docs`, `help`, `support`, `pricing`, `about`, `terms`, `privacy`

### 5.3 Middleware (`apps/web/middleware.ts`)
- Match `/{slug}/:path*`
- Validate slug exists; if not, 404
- Validate authenticated user has membership in that org; if not, 403
- Set request headers (or use AsyncLocalStorage) to make `orgId`, `orgSlug`, and `userId` available to server components and server actions
- Set `app.org_id` Postgres session variable in `withOrgContext` for any DB call

### 5.4 Layouts
- `app/(public)/layout.tsx` — public marketing/auth pages
- `app/[orgSlug]/layout.tsx` — tenant-scoped layout. Validates org context, provides org sidebar, language selector, user menu

---

## 6. i18n with next-intl

### 6.1 Setup
- `apps/web/messages/de.json` and `apps/web/messages/en-GB.json`
- Locale resolution order:
  1. `?locale=` query param
  2. User's `locale` field
  3. Org's `locale_default`
  4. Browser `Accept-Language`
  5. `de` fallback
- Locale switcher in user menu and language picker on public pages

### 6.2 Number/date formatting
Use `Intl.NumberFormat` / `Intl.DateTimeFormat` with the active locale.

- DE: `1.234,56 €`, `26.05.2026`
- EN-GB: `1,234.56 €`, `26/05/2026`

Currency is always EUR in MVP; format symbol follows locale.

### 6.3 Initial messages

Seed both message files with these keys. **Claude Code: actually translate, don't placeholder. Use these reference translations.**

```
auth.signin.title                = "Sign in" / "Anmelden"
auth.signin.email_label          = "Email" / "E-Mail"
auth.signin.submit               = "Send magic link" / "Magischen Link senden"
auth.signin.google               = "Continue with Google" / "Mit Google fortfahren"
auth.signin.microsoft            = "Continue with Microsoft" / "Mit Microsoft fortfahren"
auth.signin.magic_link_sent      = "Check your email." / "Bitte prüfen Sie Ihre E-Mails."
auth.signup.title                = "Create your account" / "Konto erstellen"
auth.signout                     = "Sign out" / "Abmelden"
onboarding.new_org.title         = "Set up your shop" / "Werkstatt einrichten"
onboarding.new_org.name_label    = "Shop name" / "Werkstattname"
onboarding.new_org.country_label = "Country" / "Land"
onboarding.new_org.locale_label  = "Default language" / "Standardsprache"
onboarding.new_org.submit        = "Create shop" / "Werkstatt erstellen"
nav.rfqs                         = "RFQs" / "Anfragen"
nav.customers                    = "Customers" / "Kunden"
nav.settings                     = "Settings" / "Einstellungen"
nav.signout                      = "Sign out" / "Abmelden"
dashboard.empty.title            = "No RFQs yet" / "Noch keine Anfragen"
dashboard.empty.subtitle         = "When customer RFQs arrive, they'll appear here." / "Wenn Anfragen von Kunden eingehen, erscheinen sie hier."
common.cancel                    = "Cancel" / "Abbrechen"
common.save                      = "Save" / "Speichern"
common.delete                    = "Delete" / "Löschen"
common.loading                   = "Loading…" / "Wird geladen…"
errors.generic                   = "Something went wrong." / "Etwas ist schiefgegangen."
errors.unauthorized              = "You don't have access to this." / "Sie haben keinen Zugriff darauf."
errors.not_found                 = "Not found." / "Nicht gefunden."
```

EN fallback is acceptable for any key not yet translated (per PRD v0.8 §2 G6).

---

## 7. UI foundation

### 7.1 Tailwind 4
- Use Tailwind 4's CSS-first config (no `tailwind.config.js` needed if using v4 properly)
- `globals.css` with design tokens as CSS custom properties

### 7.2 Design tokens

Define these as CSS variables in `globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --primary: 215 81% 38%;          /* muted technical blue */
  --primary-foreground: 0 0% 100%;
  --accent: 215 81% 96%;            /* hover tint */
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --ring: 215 81% 38%;
  --radius: 0.5rem;

  /* status colours — muted, not traffic-light */
  --status-new: 215 16% 80%;
  --status-progress: 215 81% 38%;
  --status-success: 142 65% 35%;
  --status-warning: 38 92% 50%;
  --status-neutral: 215 16% 47%;
}

@media (prefers-color-scheme: dark) {
  /* dark mode tokens — stub only, full pass in a later epic */
}
```

### 7.3 Typography
- Body: **Inter** (Google Fonts, self-hosted via `next/font`)
- Mono: **JetBrains Mono** (Google Fonts, self-hosted via `next/font`)

### 7.4 shadcn/ui components

Install these via CLI for Epic 0:
`button`, `input`, `label`, `dropdown-menu`, `select`, `dialog`, `toast` (sonner), `form`, `sheet`, `separator`, `avatar`, `badge`, `skeleton`

Other components install on demand in later epics.

### 7.5 Layout shell

Tenant-scoped layout (`app/[orgSlug]/layout.tsx`):

- Left sidebar:
  - 64px wide collapsed, 240px expanded
  - Uptool logo at top
  - Nav items (icon + label): RFQs, Customers
  - Bottom: Settings icon
- Top right of viewport: language selector + user menu (avatar dropdown with sign out)
- Main content area: white background
- Active row hover tint: `--accent`

For Epic 0, the sidebar nav links are present but only `/rfqs` needs to render anything; the rest can be placeholder pages with empty states.

---

## 8. Worker scaffold

Create `apps/worker/` with:
- Minimal BullMQ setup connected to local Redis
- One "hello world" job and processor that logs to confirm wiring
- A README explaining how to run the worker locally

No real jobs are processed in Epic 0 — this is just so Epic 1 onwards can add jobs without setting up infra.

---

## 9. Observability & DX

### 9.1 Sentry
- Wired into Next.js and the worker via official SDK
- Disabled in dev unless `SENTRY_ENABLED=true`
- Env vars in `.env.example` only — never real DSNs in repo

### 9.2 Logging
- `pino` for structured logs
- `pino-pretty` in dev

### 9.3 Local dev
- `docker-compose up -d` starts Postgres + Redis
- `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev` should be enough to get the app running locally
- README documents this in 1 page max

### 9.4 Scripts (`package.json` workspace root)
- `pnpm dev` — runs web + worker concurrently (turborepo)
- `pnpm build` — builds all packages
- `pnpm typecheck` — runs `tsc --noEmit` across all packages
- `pnpm lint` — runs Biome
- `pnpm format` — runs Biome format
- `pnpm test` — runs Vitest
- `pnpm db:migrate` — runs Drizzle migrations
- `pnpm db:seed` — runs seed script
- `pnpm db:studio` — opens Drizzle Studio

### 9.5 CI (`.github/workflows/ci.yml`)
- On push/PR: typecheck, lint, test, ensure Drizzle migrations are up to date (`drizzle-kit check`)
- Use `actions/setup-node` v4 with Node 22
- Cache pnpm + Turborepo
- **Additional check:** grep `packages/services/src/**` for forbidden imports (`from "next/`, `from "next-auth/`, `from "react"`). Fail the build if any are found.

---

## 10. Decisions log (ADRs)

Every time you make a decision that's not specified in this brief, create an Architecture Decision Record in `docs/decisions/`. Format:

```
docs/decisions/0001-use-jwt-sessions.md
```

Each ADR is short (half a page). Sections: Title, Context, Decision, Consequences.

This is how we keep the "why" alongside the "what" without slowing things down.

---

## 11. Security baseline (must be in place at end of Epic 0)

- All cookies `HttpOnly`, `Secure` in prod, `SameSite=Lax`
- CSRF protection via Auth.js defaults
- Content Security Policy headers configured in `next.config.ts`
- No `dangerouslySetInnerHTML` usage anywhere
- Secrets only via env vars; `.env.example` lists every required var with comments

---

## 12. Acceptance criteria — Epic 0 is complete when

A reviewer can:

1. Clone the repo, run `pnpm install && docker-compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` and reach `http://localhost:3000`.
2. Sign in with the seeded user's email via magic link.
3. Land on `/acme/rfqs` and see an empty-state dashboard with "No RFQs yet" message in the user's locale.
4. Switch the language from DE → EN-GB in the user menu; UI re-renders in EN-GB; number formatting follows the locale.
5. Sign up as a new user, get redirected to `/onboarding/new-org`, create an org "Test Shop" with slug `test-shop`, land on `/test-shop/rfqs`.
6. Try to access `/acme/rfqs` while signed in as the new user — get a 403.
7. Try to access `/nonexistent/rfqs` — get a 404.
8. Open Drizzle Studio (`pnpm db:studio`) and verify orgs, users, memberships rows exist.
9. Run `pnpm typecheck && pnpm lint && pnpm test` — all pass.
10. Inspect `docs/decisions/` and find at least 2–3 ADRs documenting choices the agent made.
11. Verify that RLS is actually enforced: connect to Postgres directly without `set app.org_id`, attempt `select * from audit_log` — get zero rows even when rows exist (because the policy denies them).
12. `packages/services/` exists, contains at least an `orgService` used by the onboarding flow, and no Next.js framework imports leak into it. CI greps for forbidden imports and fails the build if any are present.

---

## 13. Anti-patterns — explicitly do not

- Do not start building RFQ ingestion, AI extraction, file upload, CAD viewer, or any actual product feature. This is foundation only.
- Do not skip RLS "because it's faster without". Get it working from day one.
- Do not use `any` in TypeScript except in genuinely impossible-to-type third-party integrations (and document those with a comment).
- Do not commit `.env` or secret values.
- Do not introduce a service worker, PWA manifest, or any client-side caching layer for data — TanStack Query handles that in later epics.
- Do not build a custom auth layer "to learn how it works". Use Auth.js v5.
- Do not introduce styled-components, emotion, or runtime CSS-in-JS — Tailwind 4 only.
- Do not put business logic in server actions, route handlers, or React components. It belongs in `packages/services/`.
- Do not import `next/*`, `next-auth/*`, or `react` from `packages/services/`. CI enforces this.

---

## 14. What Epic 1 will need from Epic 0

The output of Epic 0 should make Epic 1 (email ingestion + dashboard) start cleanly. Epic 1 will:

- Add `email_accounts`, `email_threads`, `email_messages`, `attachments`, `rfqs`, `parts`, `part_files`, `block_list`, `customers`, `contacts` tables
- OAuth flows for Microsoft + Google mailbox connection
- BullMQ `PollEmailAccount` recurring job
- BullMQ `IngestEmail` job (no AI yet — just create RFQ with attachments)
- Real RFQ dashboard with TanStack Table
- RFQ detail page (stubbed)

If anything in Epic 0 makes Epic 1 hard, raise it during the session, not after.

---

## Driving the session — tips for the PM

- Start the session with: *"Please read this brief in full before doing anything. Then ask me any clarifying questions before writing code."*
- When the agent asks clarifying questions, answer them. Don't let it guess.
  - "Which email provider for magic links?" → **Resend**
  - "Color values for the primary blue — exact hex?" → use the HSL values in §7.2
  - "Do you want a marketing landing page on `/` or just redirect to signin?" → **redirect to signin for now**
- Check in after each major section completes. Especially RLS — that's the one place a small error compounds for the rest of the build.
- If the session gets long (context approaching limit), have the agent summarise progress in a `docs/STATE.md` file, then start a fresh session pointing the new agent at the repo + this brief + `STATE.md`.

---

**End of Epic 0 brief.**
