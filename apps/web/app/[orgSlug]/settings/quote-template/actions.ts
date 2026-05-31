"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@uptool/db";
import { type QuoteTemplateInput, quoteTemplateService, storageService } from "@uptool/services";
import { revalidatePath } from "next/cache";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function saveQuoteTemplate(orgSlug: string, data: QuoteTemplateInput) {
  const { userId } = await requireAuth();
  const orgId = await getOrgId(orgSlug, userId);
  await quoteTemplateService.upsert(orgId, data);
  revalidatePath(`/${orgSlug}/settings/quote-template`);
}

async function uploadImage(orgId: string, file: Blob, folder: string): Promise<string> {
  if (!file || file.size === 0) throw new Error("No file provided");
  if (file.size > 1024 * 1024) throw new Error("File too large");
  const mime = file.type;
  const ext = mime === "image/svg+xml" ? "svg" : mime === "image/png" ? "png" : "jpg";
  const key = `${orgId}/quote-template/${folder}-${Date.now()}.${ext}`;
  await storageService.upload(key, Buffer.from(await file.arrayBuffer()), mime);
  return key;
}

export async function uploadTemplateLogo(
  formData: FormData,
): Promise<{ key: string; url: string }> {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const file = formData.get("logo") as Blob | null;
  if (!file) throw new Error("No file provided");

  // Remove the previous logo, if any, before storing the new key.
  const existing = await quoteTemplateService.get(orgId);
  if (existing?.logoUrl) await storageService.delete(existing.logoUrl).catch(() => {});

  const key = await uploadImage(orgId, file, "logo");
  await quoteTemplateService.updateLogo(orgId, key);
  revalidatePath(`/${orgSlug}/settings/quote-template`);
  return { key, url: await storageService.presignedUrl(key, 3600) };
}

export async function removeTemplateLogo(formData: FormData): Promise<void> {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const existing = await quoteTemplateService.get(orgId);
  if (existing?.logoUrl) await storageService.delete(existing.logoUrl).catch(() => {});
  await quoteTemplateService.updateLogo(orgId, null);
  revalidatePath(`/${orgSlug}/settings/quote-template`);
}

/** Append a footer logo (e.g. a certification mark) and return its display URL + key. */
export async function uploadFooterLogo(
  formData: FormData,
): Promise<{ key: string; url: string }> {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const file = formData.get("logo") as Blob | null;
  if (!file) throw new Error("No file provided");

  const key = await uploadImage(orgId, file, "footer");
  const existing = await quoteTemplateService.get(orgId);
  await quoteTemplateService.setFooterLogos(orgId, [...(existing?.footerLogos ?? []), key]);
  revalidatePath(`/${orgSlug}/settings/quote-template`);
  return { key, url: await storageService.presignedUrl(key, 3600) };
}

export async function removeFooterLogo(formData: FormData): Promise<void> {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const key = formData.get("key") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const existing = await quoteTemplateService.get(orgId);
  await quoteTemplateService.setFooterLogos(
    orgId,
    (existing?.footerLogos ?? []).filter((k) => k !== key),
  );
  await storageService.delete(key).catch(() => {});
  revalidatePath(`/${orgSlug}/settings/quote-template`);
}
