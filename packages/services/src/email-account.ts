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

export interface ConnectImapInput {
  orgId: string;
  userId: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  password: string;
  // Optional SMTP (send) settings. If smtpHost is set, smtpPort + smtpPassword
  // are required (enforced by the caller/action).
  smtpHost?: string;
  smtpPort?: number;
  smtpTls?: boolean;
  smtpPassword?: string;
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

  async connectImap(input: ConnectImapInput) {
    const smtp = {
      smtpHost: input.smtpHost ?? null,
      smtpPort: input.smtpPort ?? null,
      smtpTls: input.smtpTls ?? true,
      smtpPassword: input.smtpPassword ? encrypt(input.smtpPassword) : null,
    };
    const [account] = await db
      .insert(emailAccounts)
      .values({
        orgId: input.orgId,
        provider: "imap",
        email: input.email,
        imapHost: input.imapHost,
        imapPort: input.imapPort,
        imapTls: input.imapTls,
        imapPassword: encrypt(input.password),
        status: "connected",
        authorizedByUserId: input.userId,
        ...smtp,
      })
      .onConflictDoUpdate({
        target: [emailAccounts.orgId, emailAccounts.email],
        set: {
          provider: "imap",
          imapHost: input.imapHost,
          imapPort: input.imapPort,
          imapTls: input.imapTls,
          imapPassword: encrypt(input.password),
          status: "connected",
          errorMessage: null,
          authorizedByUserId: input.userId,
          // Clear any OAuth tokens if this address was previously connected via OAuth.
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          ...smtp,
        },
      })
      .returning();
    // Same recurring-poll registration as OAuth connect. Non-fatal.
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

  /** Assign (or clear, with null) the send-as owner for an account. */
  async setOwner(accountId: string, orgId: string, ownerUserId: string | null) {
    await db
      .update(emailAccounts)
      .set({ ownerUserId })
      .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.orgId, orgId)));
  },

  /**
   * Make an account the org's default send account. Clears the prior default in
   * the same transaction so the partial unique index (one default per org) holds.
   */
  async setDefaultSend(accountId: string, orgId: string) {
    await db.transaction(async (tx) => {
      await tx
        .update(emailAccounts)
        .set({ isDefaultSend: false })
        .where(and(eq(emailAccounts.orgId, orgId), eq(emailAccounts.isDefaultSend, true)));
      await tx
        .update(emailAccounts)
        .set({ isDefaultSend: true })
        .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.orgId, orgId)));
    });
  },
};
