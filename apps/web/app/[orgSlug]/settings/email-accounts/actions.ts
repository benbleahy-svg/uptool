"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { emailAccountService, blockListService } from "@uptool/services";

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
    scope: "offline_access Mail.Read User.Read",
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
    scope: "https://www.googleapis.com/auth/gmail.readonly email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
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
