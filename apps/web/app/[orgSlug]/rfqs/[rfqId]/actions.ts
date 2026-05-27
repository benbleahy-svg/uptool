"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { rfqService } from "@uptool/services";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function updateQuantityBreaks(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const raw = formData.get("quantities") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const quantities = [...new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  )].sort((a, b) => a - b);

  if (quantities.length === 0) return;

  await rfqService.updateQuantityBreaks(orgId, rfqId, quantities);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}`);
}

export async function updateAssignee(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const assigneeId = (formData.get("assigneeId") as string) || null;
  const orgId = await getOrgId(orgSlug, userId);

  await rfqService.updateAssignee(orgId, rfqId, assigneeId);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}`);
  revalidatePath(`/${orgSlug}/rfqs`);
}
