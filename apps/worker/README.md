# Worker

BullMQ job worker. Connects to Redis and processes background jobs.

## Running locally

```bash
# Start Redis (from repo root)
docker-compose up -d

# Run worker in dev mode (tsx watch)
pnpm dev
```

The worker runs alongside the web app when you use `pnpm dev` from the repo root.

## Adding jobs

1. Add a queue name to `QUEUE_NAMES` in `src/queues.ts`
2. Create a processor in `src/processors/`
3. Register it in `src/index.ts`
4. Add the queue export so the web app can enqueue jobs
