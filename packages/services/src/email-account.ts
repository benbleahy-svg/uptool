import { db, emailAccounts } from "@uptool/db";
import { encrypt } from "@uptool/shared/crypto";
import { and, eq } from "drizzle-orm";
import { cancelAccountPoll, registerAccountPoll } from "./email-poll-scheduler";

export interface ConnectAccountInput {
  orgId: string;
  userId: string;
  provider: "microsoft" | "gmail";
  email: string;
  displayName?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export const emailAccountService = {
  async connect(input: ConnectAccountInput) {
    const [account] = await db
      .insert(emailAccounts)
      .values({
        orgId: input.orgId,
        provider: input.provider,
        email: input.email,
        displayName: input.displayName,
        accessToken: encrypt(input.accessToken),
        refreshToken: input.refreshToken ? encrypt(input.refreshToken) : null,
        tokenExpiresAt: input.expiresAt,
        status: "connected",
        authorizedByUserId: input.userId,
      })
      .onConflictDoUpdate({
        target: [emailAccounts.orgId, emailAccounts.email],
        set: {
          displayName: input.displayName,
          accessToken: encrypt(input.accessToken),
          refreshToken: input.refreshToken ? encrypt(input.refreshToken) : undefined,
          tokenExpiresAt: input.expiresAt,
          status: "connected",
          errorMessage: null,
          authorizedByUserId: input.userId,
        },
      })
      .returning();
    // Register the recurring poll for this account. Non-fatal: a transient Redis
    // failure here is reconciled by the worker's startup sync.
    if (account) {
      try {
        await registerAccountPoll(account.id, account.orgId);
      } catch (err) {
        console.error("Failed to register poll scheduler for account", account.id, err);
      }
    }
    return account;
  },

  async findByOrg(orgId: string) {
    return db.query.emailAccounts.findMany({
      where: (a, { eq, ne, and }) => and(eq(a.orgId, orgId), ne(a.status, "disconnected")),
      with: { authorizedBy: true },
      orderBy: (a, { asc }) => [asc(a.createdAt)],
    });
  },

  async findConnected(orgId: string) {
    return db.query.emailAccounts.findMany({
      where: (a, { eq, and }) => and(eq(a.orgId, orgId), eq(a.status, "connected")),
    });
  },

  async updateStatus(
    accountId: string,
    status: "connected" | "error" | "disconnected",
    errorMessage?: string,
  ) {
    await db
      .update(emailAccounts)
      .set({ status, errorMessage: errorMessage ?? null })
      .where(eq(emailAccounts.id, accountId));
  },

  async updateLastChecked(accountId: string) {
    await db
      .update(emailAccounts)
      .set({ lastCheckedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));
  },

  async softDelete(accountId: string, orgId: string) {
    await db
      .update(emailAccounts)
      .set({ status: "disconnected" })
      .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.orgId, orgId)));
    // Stop the recurring poll. Non-fatal / idempotent.
    try {
      await cancelAccountPoll(accountId);
    } catch (err) {
      console.error("Failed to cancel poll scheduler for account", accountId, err);
    }
  },
};
