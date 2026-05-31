"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@uptool/db";
import { type EmailTemplates, emailTemplateService } from "@uptool/services";
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

export async function saveEmailTemplates(orgSlug: string, data: EmailTemplates) {
  const { userId } = await requireAuth();
  const orgId = await getOrgId(orgSlug, userId);
  await emailTemplateService.upsert(orgId, data);
  revalidatePath(`/${orgSlug}/settings/email-templates`);
}
