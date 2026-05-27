"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { memberService } from "@uptool/services";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function addMember(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const email = formData.get("email") as string;
  const role = (formData.get("role") as string) || "estimator";
  const orgId = await getOrgId(orgSlug, userId);

  await memberService.add(orgId, email, role as "owner" | "estimator" | "office");
  revalidatePath(`/${orgSlug}/settings/members`);
}

export async function removeMember(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const targetUserId = formData.get("userId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  if (targetUserId === userId) throw new Error("Cannot remove yourself");
  await memberService.remove(orgId, targetUserId);
  revalidatePath(`/${orgSlug}/settings/members`);
}

export async function updateMemberRole(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const targetUserId = formData.get("userId") as string;
  const role = formData.get("role") as "owner" | "estimator" | "office";
  const orgId = await getOrgId(orgSlug, userId);

  await memberService.updateRole(orgId, targetUserId, role);
  revalidatePath(`/${orgSlug}/settings/members`);
}
