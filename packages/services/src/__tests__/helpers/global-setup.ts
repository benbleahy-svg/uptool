// Vitest globalSetup: ensure a dedicated `uptool_test` database exists and is
// migrated to the latest schema before the suite runs. Test workers connect to
// it via DATABASE_URL (set in vitest.config.ts → test.env), so services exercise
// the real `db` singleton against an isolated database — never the dev DB.
//
// Requires a running Postgres (the local Docker one). Override the target with
// TEST_DATABASE_URL.

import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://uptool:uptool@localhost:5432/uptool_test";

export default async function setup() {
  const url = new URL(TEST_URL);
  const dbName = url.pathname.replace(/^\//, "") || "uptool_test";

  // Connect to an existing DB (the dev `uptool` DB) to issue CREATE DATABASE.
  const adminUrl = new URL(TEST_URL);
  adminUrl.pathname = "/uptool";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  // Apply all migrations to the test DB (idempotent — drizzle tracks applied).
  const client = postgres(TEST_URL, { max: 1 });
  const migrationsFolder = fileURLToPath(new URL("../../../../db/migrations", import.meta.url));
  await migrate(drizzle(client), { migrationsFolder });
  await client.end();
}
