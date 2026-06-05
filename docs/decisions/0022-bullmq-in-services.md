# 0022 — BullMQ dependency in the services layer

Status: Accepted
Date: 2026-06-05

## Context

Connected email accounts are polled by a recurring BullMQ job. Each connected
`email_accounts` row gets its own **repeatable** poll job; that scheduler must be
**registered when an account connects** and **cancelled when it disconnects**
(see the recurring-poll fix that replaced the broken `setInterval` +
static-`jobId` pattern).

The account lifecycle does not live in the worker. An account is created in the
**web** process: the Gmail/Microsoft OAuth callback
(`apps/web/app/api/email-accounts/callback/*`) calls
`emailAccountService.connect()`, and disconnect calls
`emailAccountService.softDelete()` — both in `packages/services`. So the
register/cancel side effect has to be reachable from the web request path,
which only ever reaches BullMQ *through* the services layer.

Options considered:

1. **Worker-only scheduling.** Keep all queue code in `apps/worker`. The web
   process would then have to tell the worker about every connect/disconnect via
   a separate channel — an internal HTTP endpoint, a pub/sub message, or a DB
   flag the worker polls. Each adds a moving part and a new failure mode purely
   to relay "an account's connected state changed."
2. **Producer in services (chosen).** Let `packages/services` own the poll-queue
   *producer* (register/cancel/sync). `connect()`/`softDelete()` call it directly;
   the worker owns the *consumer*. The queue is shared across processes by Redis +
   queue-name convention, exactly as the existing CAD-thumbnail pipeline already
   does (`apps/web/lib/cad-thumbnail-queue.ts` is a web-side producer for a
   worker-side consumer).

Option 1 reintroduces the web→worker coupling we'd otherwise avoid; Option 2
keeps the side effect next to the lifecycle event that triggers it.

## Decision

1. **Accept `bullmq` as a dependency of `packages/services`** (`^5.34.5`, matching
   `apps/worker`). This does not violate the services-layer rule — the CI grep
   only forbids `next/*`, `next-auth/*`, and `react` imports; BullMQ is a plain
   Node library.

2. **New module `packages/services/src/email-poll-scheduler.ts`** exposes
   `registerAccountPoll`, `cancelAccountPoll`, and `syncAccountPolls`, built on
   BullMQ's native `upsertJobScheduler` / `removeJobScheduler` (the correct
   primitive for recurring jobs). The worker is the only consumer; queue name
   `poll-email-account` must stay in sync with
   `apps/worker/src/queues.ts` (`QUEUE_NAMES.POLL_EMAIL_ACCOUNT`).

3. **Lazy, `globalThis`-cached queue.** The `Queue` is created on first
   register/cancel/sync call, not at module load, and cached on `globalThis`:

   ```ts
   function getQueue(): Queue {
     const g = globalThis as unknown as { __pollEmailQueue?: Queue };
     if (g.__pollEmailQueue) return g.__pollEmailQueue;
     const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
     const queue = new Queue("poll-email-account", {
       connection: { host: redisUrl.hostname, port: Number(redisUrl.port) || 6379 },
     });
     g.__pollEmailQueue = queue;
     return queue;
   }
   ```

   - **Lazy** so merely importing `@uptool/services` (which the web app does in
     many server actions / RSCs, and which tests do) never opens a Redis
     connection — only actually scheduling a poll does.
   - **`globalThis` cache** so Next.js dev hot-reloads reuse one `Queue` instead
     of leaking a Redis connection on every recompile. This mirrors the pattern
     already used by `apps/web/lib/cad-thumbnail-queue.ts`.

4. **Registration is non-fatal.** `connect()`/`softDelete()` wrap the
   register/cancel call in try/catch and log on failure — a transient Redis
   problem must not fail an OAuth connect. The worker's startup
   `syncAccountPolls` reconciles any account whose registration was missed.

## Consequences

- **Redis reachability is now part of the scheduling path in both processes.**
  The worker already needed `REDIS_URL`; the **web** process now also needs it
  whenever an account is connected/disconnected. If Redis is down at that moment,
  the (caught) registration is skipped and recovered by the worker's next
  startup sync — connect still succeeds.
- **Unit tests that import services must mock or skip the scheduler.** Because the
  queue is lazy, importing services is safe, but any test that exercises
  `connect()`/`softDelete()` (or calls the scheduler directly) will try to reach
  Redis. Such tests should stub `email-poll-scheduler` or run against a test
  Redis. No current test exercises this path.
- **Two producers of the same queue now exist by convention, not by type.** The
  web-side `connect()` and the worker-side startup sync both write the same
  `poll-account-<id>` scheduler; correctness depends on the shared queue name and
  scheduler-id format, not a shared symbol. Same trade-off the CAD-thumbnail
  pipeline already accepts.
- **`bullmq` (and its `ioredis` subdep) is pulled into the web server bundle**
  via services. This is already handled by `serverExternalPackages: ["bullmq"]`
  in `apps/web/next.config.ts`; services carries no `"server-only"` marker
  because the worker imports it too.
