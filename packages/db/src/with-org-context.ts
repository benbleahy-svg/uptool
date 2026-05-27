import { sql } from "drizzle-orm";
import { db } from "./client";

export async function withOrgContext<T>(
  orgId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return fn(tx as unknown as typeof db);
  });
}
