"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { customerService } from "@uptool/services";

async function getOrg(orgSlug: string) {
  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) throw new Error("Org not found");
  return org;
}

export async function addContact(formData: FormData) {
  await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const customerId = formData.get("customerId") as string;
  const email = formData.get("email") as string;
  const name = (formData.get("name") as string) || undefined;

  const org = await getOrg(orgSlug);
  await customerService.addContact(org.id, customerId, email, name);
  revalidatePath(`/${orgSlug}/customers/${customerId}`);
}

export async function removeContact(formData: FormData) {
  await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const customerId = formData.get("customerId") as string;
  const contactId = formData.get("contactId") as string;

  const org = await getOrg(orgSlug);
  await customerService.removeContact(org.id, contactId);
  revalidatePath(`/${orgSlug}/customers/${customerId}`);
}
