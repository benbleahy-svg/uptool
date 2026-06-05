import { db, rfqs, users } from "@uptool/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";
import { resolveSendAccount } from "../index";
import { createOrg, createRfqWithPart, createSendAccount, dropOrg } from "./helpers/fixtures";

const createdOrgs: string[] = [];
const createdUsers: string[] = [];

afterEach(async () => {
  for (const id of createdOrgs.splice(0)) await dropOrg(id);
  for (const id of createdUsers.splice(0)) await db.delete(users).where(eq(users.id, id));
});

async function mkUser(): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({ email: `u-${crypto.randomUUID()}@t.test` })
    .returning({ id: users.id });
  if (!u) throw new Error("failed to create user");
  createdUsers.push(u.id);
  return u.id;
}

async function setup() {
  const orgId = await createOrg();
  createdOrgs.push(orgId);
  const { rfqId } = await createRfqWithPart(orgId);
  return { orgId, rfqId };
}

async function linkRfq(rfqId: string, accountId: string) {
  await db.update(rfqs).set({ emailAccountId: accountId }).where(eq(rfqs.id, rfqId));
}

describe("resolveSendAccount chain", () => {
  test("step 1: account owned by the sending user wins over the org default", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser();
    const owned = await createSendAccount(orgId, { ownerUserId: userId, isDefaultSend: false });
    await createSendAccount(orgId, { isDefaultSend: true }); // org default (should lose)

    const acc = await resolveSendAccount(orgId, rfqId, userId);
    expect(acc?.id).toBe(owned);
  });

  test("step 1 tiebreak: among owned accounts, prefers the RFQ-linked one", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser();
    await createSendAccount(orgId, { ownerUserId: userId, isDefaultSend: false }); // first created
    const ownedLinked = await createSendAccount(orgId, {
      ownerUserId: userId,
      isDefaultSend: false,
    });
    await linkRfq(rfqId, ownedLinked);

    const acc = await resolveSendAccount(orgId, rfqId, userId);
    expect(acc?.id).toBe(ownedLinked);
  });

  test("step 2: RFQ-linked account when the user owns none", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser(); // owns nothing
    const linked = await createSendAccount(orgId, { isDefaultSend: false });
    await linkRfq(rfqId, linked);

    const acc = await resolveSendAccount(orgId, rfqId, userId);
    expect(acc?.id).toBe(linked);
  });

  test("step 3: org default when no owned + no RFQ link", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser();
    const def = await createSendAccount(orgId, { isDefaultSend: true });

    const acc = await resolveSendAccount(orgId, rfqId, userId);
    expect(acc?.id).toBe(def);
  });

  test("step 4: null when nothing connected", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser();
    await createSendAccount(orgId, { isDefaultSend: true, status: "disconnected" });

    const acc = await resolveSendAccount(orgId, rfqId, userId);
    expect(acc).toBeNull();
  });

  test("missing userId skips step 1 → falls through to the org default", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser();
    await createSendAccount(orgId, { ownerUserId: userId, isDefaultSend: false }); // owned, but...
    const def = await createSendAccount(orgId, { isDefaultSend: true });

    const acc = await resolveSendAccount(orgId, rfqId); // no userId
    expect(acc?.id).toBe(def);
  });

  test("disconnected owned account is skipped (status filter)", async () => {
    const { orgId, rfqId } = await setup();
    const userId = await mkUser();
    await createSendAccount(orgId, {
      ownerUserId: userId,
      isDefaultSend: false,
      status: "disconnected",
    });
    const def = await createSendAccount(orgId, { isDefaultSend: true });

    const acc = await resolveSendAccount(orgId, rfqId, userId);
    expect(acc?.id).toBe(def);
  });
});
