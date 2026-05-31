"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import { partService, templateService, rfqService } from "@uptool/services";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

export async function addPart(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await partService.create({
    orgId,
    rfqId,
    partNumber: (formData.get("partNumber") as string) || undefined,
    revision: (formData.get("revision") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    material: (formData.get("material") as string) || undefined,
    finish: (formData.get("finish") as string) || undefined,
    processType: (formData.get("processType") as string) || undefined,
    materialCostCents: Math.round(
      Number.parseFloat((formData.get("materialCostEuros") as string) || "0") * 100,
    ),
  });

  await rfqService.advanceToEstimated(orgId, rfqId);

  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/estimate`);
}

// Persist a part's No-Bid flag (the estimation footer also tracks it in session
// state for the live UI; this makes it durable so the dashboard can derive
// Declined when every part is no-bid). No revalidate — the footer drives the UI.
export async function setPartNoBid(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const partId = formData.get("partId") as string;
  const isNoBid = formData.get("isNoBid") === "true";
  const orgId = await getOrgId(orgSlug, userId);

  await partService.setNoBid(orgId, partId, isNoBid);
}

export async function deletePart(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const partId = formData.get("partId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await partService.delete(orgId, partId);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/estimate`);
}

export async function addOperation(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const partId = formData.get("partId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const opType = formData.get("operationType") as string;
  const templateId = (formData.get("templateId") as string) || null;

  await partService.addOperation({
    orgId,
    partId,
    name: formData.get("name") as string,
    operationType: opType === "expense" ? "expense" : "machining",
    setupMinutes: Number.parseFloat((formData.get("setupMinutes") as string) || "0"),
    runMinutes: Number.parseFloat((formData.get("runMinutes") as string) || "0"),
    hourlyRateCents: Math.round(
      Number.parseFloat((formData.get("hourlyRateEuros") as string) || "0") * 100,
    ),
    isNonRecurring: formData.get("isNonRecurring") === "true",
  });

  if (templateId) {
    await templateService.recordUsage(orgId, templateId);
  }

  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/estimate`);
}

export async function deleteOperation(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const operationId = formData.get("operationId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await partService.deleteOperation(orgId, operationId);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/estimate`);
}

export async function updatePartNotes(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const partId = formData.get("partId") as string;
  const notesExternal = (formData.get("notesExternal") as string) || null;
  const notesInternal = (formData.get("notesInternal") as string) || null;
  const orgId = await getOrgId(orgSlug, userId);

  await partService.updatePartNotes(orgId, partId, notesExternal, notesInternal);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/estimate`);
}

export async function copyOperations(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const toPartId = formData.get("toPartId") as string;
  const fromPartId = formData.get("fromPartId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await partService.copyOperations(orgId, fromPartId, toPartId);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/estimate`);
}
