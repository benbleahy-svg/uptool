// Test fixtures against the `uptool_test` DB. Each test creates a throwaway org
// (unique slug) and tears it down via cascade, so tests don't depend on or
// pollute each other.

import { db, orgs, parts, rfqs } from "@uptool/db";
import { eq } from "drizzle-orm";

export async function createOrg(): Promise<string> {
  const [org] = await db
    .insert(orgs)
    .values({ name: "Test Org", slug: `test-${crypto.randomUUID()}`, country: "DE" })
    .returning({ id: orgs.id });
  if (!org) throw new Error("fixture: failed to create org");
  return org.id;
}

export async function createRfqWithPart(orgId: string): Promise<{ rfqId: string; partId: string }> {
  const [rfq] = await db
    .insert(rfqs)
    .values({
      orgId,
      rfqNumber: Math.floor(Math.random() * 1_000_000_000),
      receivedAt: new Date(),
    })
    .returning({ id: rfqs.id });
  if (!rfq) throw new Error("fixture: failed to create rfq");

  const [part] = await db
    .insert(parts)
    .values({ orgId, rfqId: rfq.id })
    .returning({ id: parts.id });
  if (!part) throw new Error("fixture: failed to create part");

  return { rfqId: rfq.id, partId: part.id };
}

/** Add an extra part to an existing RFQ (for cross-part reorder tests). */
export async function createPart(orgId: string, rfqId: string): Promise<string> {
  const [part] = await db.insert(parts).values({ orgId, rfqId }).returning({ id: parts.id });
  if (!part) throw new Error("fixture: failed to create part");
  return part.id;
}

/** Delete an org; cascades to rfqs → parts → operations/materials. */
export async function dropOrg(orgId: string): Promise<void> {
  await db.delete(orgs).where(eq(orgs.id, orgId));
}
