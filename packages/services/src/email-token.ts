import { db, emailAccounts } from "@uptool/db";
import { decrypt, encrypt } from "@uptool/shared";
import { eq } from "drizzle-orm";

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export async function getDecryptedTokens(accountId: string): Promise<TokenSet> {
  const account = await db.query.emailAccounts.findFirst({
    where: (a, { eq }) => eq(a.id, accountId),
  });
  if (!account) throw new Error(`Email account ${accountId} not found`);

  return {
    accessToken: account.accessToken ? decrypt(account.accessToken) : "",
    refreshToken: account.refreshToken ? decrypt(account.refreshToken) : null,
    expiresAt: account.tokenExpiresAt,
  };
}

export async function saveEncryptedTokens(
  accountId: string,
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date },
): Promise<void> {
  await db
    .update(emailAccounts)
    .set({
      accessToken: encrypt(tokens.accessToken),
      refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokens.expiresAt,
    })
    .where(eq(emailAccounts.id, accountId));
}

export async function refreshMicrosoftToken(accountId: string): Promise<string> {
  const tokens = await getDecryptedTokens(accountId);
  if (!tokens.refreshToken) throw new Error("No refresh token stored");

  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
      scope: "Mail.Read Mail.Send offline_access User.Read",
    }),
  });

  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await saveEncryptedTokens(accountId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt,
  });
  return data.access_token;
}

export async function refreshGmailToken(accountId: string): Promise<string> {
  const tokens = await getDecryptedTokens(accountId);
  if (!tokens.refreshToken) throw new Error("No refresh token stored");

  const clientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId ?? "",
      client_secret: clientSecret ?? "",
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  await saveEncryptedTokens(accountId, {
    accessToken: data.access_token,
    refreshToken: tokens.refreshToken,
    expiresAt,
  });
  return data.access_token;
}

export async function getValidAccessToken(accountId: string, provider: string): Promise<string> {
  const tokens = await getDecryptedTokens(accountId);
  const fiveMinutes = 5 * 60 * 1000;
  const nearExpiry = tokens.expiresAt && tokens.expiresAt.getTime() - Date.now() < fiveMinutes;

  if (!nearExpiry && tokens.accessToken) return tokens.accessToken;

  if (provider === "microsoft") return refreshMicrosoftToken(accountId);
  if (provider === "gmail") return refreshGmailToken(accountId);
  throw new Error(`Unknown provider: ${provider}`);
}
