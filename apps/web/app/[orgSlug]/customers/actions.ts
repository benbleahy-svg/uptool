"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { customerService } from "@uptool/services";

export async function createCompany(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const name = ((formData.get("name") as string) ?? "").trim();
  const domain = ((formData.get("domain") as string) ?? "").trim();
  if (!name) throw new Error("Company name is required");

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");

  await customerService.createCompany(org.id, name, domain);
  revalidatePath(`/${orgSlug}/customers`);
}
