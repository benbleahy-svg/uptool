"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { blockListService } from "@uptool/services";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function addBlockEntry(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const value = formData.get("value") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await blockListService.add(orgId, value);
  revalidatePath(`/${orgSlug}/settings/block-list`);
}

export async function removeBlockEntry(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const entryId = formData.get("entryId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await blockListService.remove(orgId, entryId);
  revalidatePath(`/${orgSlug}/settings/block-list`);
}
