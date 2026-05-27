"use server";

import { redirect } from "next/navigation";
import { orgService } from "@uptool/services";
import { CreateOrgSchema } from "@uptool/shared";
import { requireAuth } from "@/lib/auth";

export async function createOrgAction(formData: FormData): Promise<void> {
  const { userId } = await requireAuth();

  const raw = {
    name: formData.get("name"),
    country: formData.get("country"),
    locale: formData.get("locale"),
  };

  const parsed = CreateOrgSchema.safeParse(raw);
  if (!parsed.success) {
    // In a later epic, we'd use useFormState to return errors to the client.
    // For now, throw — the error will surface as a generic error boundary.
    throw new Error(`Invalid form data: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }

  const org = await orgService.create({ userId, ...parsed.data });
  redirect(`/${org.slug}/rfqs`);
}
