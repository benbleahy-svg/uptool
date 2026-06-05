"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import {
  emailAccountService,
  blockListService,
  ImapConnectionError,
  testImapConnection,
} from "@uptool/services";

function encodeState(data: { orgId: string; userId: string; orgSlug: string }): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

async function resolveOrg(orgSlug: string, userId: string) {
  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) throw new Error("Org not found");

  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");

  return org;
}

export async function connectMicrosoftAccount(orgSlug: string) {
  const { userId } = await requireAuth();
  const org = await resolveOrg(orgSlug, userId);

  const state = encodeState({ orgId: org.id, userId, orgSlug });
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "";
  const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "common";
  const redirectUri = process.env.MICROSOFT_GRAPH_REDIRECT_URI ?? "";

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "offline_access Mail.Read Mail.Send User.Read",
    state,
  });

  redirect(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`,
  );
}

export async function connectGoogleAccount(orgSlug: string) {
  const { userId } = await requireAuth();
  const org = await resolveOrg(orgSlug, userId);

  const state = encodeState({ orgId: org.id, userId, orgSlug });
  const clientId = process.env.AUTH_GOOGLE_ID ?? "";
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI ?? "";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

const imapInputSchema = z
  .object({
    email: z.string().email(),
    imapHost: z.string().trim().min(1),
    imapPort: z.number().int().min(1).max(65535),
    imapTls: z.boolean(),
    password: z.string().min(1),
    // Optional SMTP (send) group.
    smtpHost: z.string().trim().optional(),
    smtpPort: z.number().int().min(1).max(65535).optional(),
    smtpTls: z.boolean().optional(),
    smtpPassword: z.string().optional(),
  })
  // If an SMTP host is given, port + password are required as a group.
  .refine((v) => !v.smtpHost || (v.smtpPort != null && !!v.smtpPassword), {
    message: "smtp_incomplete",
  });

export type ConnectImapResult = { ok: true } | { ok: false; error: "invalid" | "connect_failed" };

export async function connectImapAction(
  orgSlug: string,
  input: z.input<typeof imapInputSchema>,
): Promise<ConnectImapResult> {
  const { userId } = await requireAuth();
  const org = await resolveOrg(orgSlug, userId);

  const parsed = imapInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { email, imapHost, imapPort, imapTls, password, smtpHost, smtpPort, smtpTls, smtpPassword } =
    parsed.data;

  // Verify credentials BEFORE persisting — never save a config that can't connect.
  try {
    await testImapConnection({ email, imapHost, imapPort, imapTls, password });
  } catch (err) {
    if (err instanceof ImapConnectionError) return { ok: false, error: "connect_failed" };
    throw err;
  }

  await emailAccountService.connectImap({
    orgId: org.id,
    userId,
    email,
    imapHost,
    imapPort,
    imapTls,
    password,
    smtpHost: smtpHost || undefined,
    smtpPort,
    smtpTls,
    smtpPassword: smtpPassword || undefined,
  });

  revalidatePath(`/${orgSlug}/settings/email-accounts`);
  return { ok: true };
}

export async function setOwnerAction(orgSlug: string, accountId: string, ownerUserId: string | null) {
  const { userId } = await requireAuth();
  const org = await resolveOrg(orgSlug, userId);
  await emailAccountService.setOwner(accountId, org.id, ownerUserId);
  revalidatePath(`/${orgSlug}/settings/email-accounts`);
  // Owner/default changes affect the Send page's resolved "from" account.
  revalidatePath(`/${orgSlug}/rfqs`, "layout");
}

export async function setDefaultSendAction(orgSlug: string, accountId: string) {
  const { userId } = await requireAuth();
  const org = await resolveOrg(orgSlug, userId);
  await emailAccountService.setDefaultSend(accountId, org.id);
  revalidatePath(`/${orgSlug}/settings/email-accounts`);
  // Owner/default changes affect the Send page's resolved "from" account.
  revalidatePath(`/${orgSlug}/rfqs`, "layout");
}

export async function disconnectEmailAccount(formData: FormData) {
  const { userId } = await requireAuth();
  const accountId = formData.get("accountId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const org = await resolveOrg(orgSlug, userId);
  await emailAccountService.softDelete(accountId, org.id);
  revalidatePath(`/${orgSlug}/settings/email-accounts`);
}

export async function addBlockListEntry(formData: FormData) {
  const { userId } = await requireAuth();
  const value = (formData.get("value") as string)?.trim();
  const orgSlug = formData.get("orgSlug") as string;
  if (!value) return;
  const org = await resolveOrg(orgSlug, userId);
  await blockListService.add(org.id, value);
  revalidatePath(`/${orgSlug}/settings/email-accounts`);
}

export async function removeBlockListEntry(formData: FormData) {
  const { userId } = await requireAuth();
  const entryId = formData.get("entryId") as string;
  const orgSlug = formData.get("orgSlug") as string;
  const org = await resolveOrg(orgSlug, userId);
  await blockListService.remove(org.id, entryId);
  revalidatePath(`/${orgSlug}/settings/email-accounts`);
}
