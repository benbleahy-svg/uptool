"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { templateService } from "@uptool/services";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function addTemplate(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);
  const opType = formData.get("operationType") as string;

  await templateService.create({
    orgId,
    name: formData.get("name") as string,
    operationType: opType === "expense" ? "expense" : "machining",
    defaultSetupMinutes: Number.parseFloat((formData.get("setupMinutes") as string) || "0"),
    defaultRunMinutes: Number.parseFloat((formData.get("runMinutes") as string) || "0"),
    defaultHourlyRateCents: Math.round(
      Number.parseFloat((formData.get("rateEuros") as string) || "0") * 100,
    ),
  });

  revalidatePath(`/${orgSlug}/settings/operation-templates`);
}

export async function deleteTemplate(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const templateId = formData.get("templateId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await templateService.delete(orgId, templateId);
  revalidatePath(`/${orgSlug}/settings/operation-templates`);
}
