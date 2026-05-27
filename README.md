# Uptool DACH

AI-powered quoting platform for high-mix, low-volume manufacturing shops in Germany, Austria, and Switzerland.

## Local development

### Prerequisites

- Node.js 22 LTS
- pnpm 9.x (`npm install -g pnpm@9`)
- Docker (for Postgres + Redis)

### First-time setup

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env — AUTH_SECRET is required: openssl rand -base64 32

# 2. Start Postgres + Redis
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Run database migrations
pnpm db:migrate

# 5. Seed test data
pnpm db:seed
# Creates: Acme GmbH (slug: acme), user: owner@acme.test

# 6. Start dev server
pnpm dev
# → http://localhost:3000
```

### Sign in (local)

Go to `http://localhost:3000/signin`, enter `owner@acme.test`. The magic link URL prints to the Next.js terminal — click it to sign in and land on `/acme/rfqs`.

### Common commands

```bash
pnpm dev          # web + worker concurrently
pnpm typecheck    # TypeScript check across all packages
pnpm lint         # Biome lint
pnpm format       # Biome format (writes)
pnpm test         # Vitest
pnpm db:studio    # Open Drizzle Studio (DB GUI)
```

## Troubleshooting

### Stale build cache (`Cannot find module './XXXX.js'`)

Next.js occasionally produces stale chunk references after a dependency update or a version switch. Clear all build caches and restart:

```bash
pnpm fresh
```

This runs `pnpm clean` (deletes `.next`, `.turbo`, and `dist` directories across the monorepo) then reinstalls and starts dev. Run `pnpm clean` alone if you only want to wipe caches without restarting.

### MinIO bucket missing

If you see S3 errors on first run, the `uptool-attachments` bucket needs to be created once:

```bash
docker compose exec minio mc alias set local http://localhost:9000 uptool uptool123
docker compose exec minio mc mb local/uptool-attachments
```

## Architecture

See [`CLAUDE.md`](./CLAUDE.md) for full architecture docs, and [`docs/decisions/`](./docs/decisions/) for ADRs.
