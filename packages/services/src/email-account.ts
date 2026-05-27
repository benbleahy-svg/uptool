import { db, emailAccounts } from "@uptool/db";
import { encrypt } from "@uptool/shared";
import { and, eq } from "drizzle-orm";

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
  },
};
