"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { orgService, storageService } from "@uptool/services";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function saveGeneralSettings(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const rateEuros = Number.parseFloat((formData.get("defaultRateEuros") as string) || "0");

  await orgService.updateGeneralSettings(orgId, {
    name: (formData.get("name") as string) || "Unnamed",
    vatId: (formData.get("vatId") as string) || null,
    phone: (formData.get("phone") as string) || null,
    website: (formData.get("website") as string) || null,
    street: (formData.get("street") as string) || null,
    postal: (formData.get("postal") as string) || null,
    city: (formData.get("city") as string) || null,
    country: ((formData.get("country") as string) || "DE") as "DE" | "AT" | "CH",
    defaultHourlyRateCents: Math.round(rateEuros * 100),
  });

  revalidatePath(`/${orgSlug}/settings/general`);
}

export async function uploadLogo(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const file = formData.get("logo") as Blob | null;
  if (!file || file.size === 0) throw new Error("No file provided");
  if (file.size > 1024 * 1024) throw new Error("File too large");

  const mime = file.type;
  const ext = mime === "image/svg+xml" ? "svg" : mime === "image/png" ? "png" : "jpg";
  const key = `${orgId}/branding/logo-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await storageService.upload(key, buffer, mime);
  await orgService.updateLogoUrl(orgId, key);

  revalidatePath(`/${orgSlug}/settings/general`);
  revalidatePath(`/${orgSlug}/rfqs`);
}

export async function removeLogo(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.id, orgId) });
  if (org?.logoUrl) {
    await storageService.delete(org.logoUrl);
  }
  await orgService.updateLogoUrl(orgId, null);

  revalidatePath(`/${orgSlug}/settings/general`);
  revalidatePath(`/${orgSlug}/rfqs`);
}
