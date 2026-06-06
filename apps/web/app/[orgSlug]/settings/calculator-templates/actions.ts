"use server";

import { db } from "@uptool/db";
import {
  type CostCategory,
  type OperationTemplateType,
  templateService,
} from "@uptool/services";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

const OP_TYPES: OperationTemplateType[] = [
  "machining",
  "inspection",
  "pack-and-ship",
  "finishing",
  "expense",
  "other",
];
const COST_CATEGORIES: CostCategory[] = ["inside", "outside", "purchased"];

function asOpType(v: string): OperationTemplateType {
  return OP_TYPES.includes(v as OperationTemplateType) ? (v as OperationTemplateType) : "machining";
}
function asCostCategory(v: string): CostCategory {
  return COST_CATEGORIES.includes(v as CostCategory) ? (v as CostCategory) : "inside";
}
function eurosToCents(v: string): number {
  return Math.round(Number.parseFloat((v || "0").replace(",", ".")) * 100);
}

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

  await templateService.create({
    orgId,
    name: (formData.get("name") as string).trim(),
    operationType: asOpType(formData.get("operationType") as string),
    costCategory: asCostCategory(formData.get("costCategory") as string),
    defaultSetupMinutes: Number.parseFloat((formData.get("setupMinutes") as string) || "0"),
    defaultRunMinutes: Number.parseFloat((formData.get("runMinutes") as string) || "0"),
    defaultHourlyRateCents: eurosToCents(formData.get("rateEuros") as string),
  });

  revalidatePath(`/${orgSlug}/settings/calculator-templates`);
}

export async function updateTemplate(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const templateId = formData.get("templateId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await templateService.update(orgId, templateId, {
    name: (formData.get("name") as string).trim(),
    operationType: asOpType(formData.get("operationType") as string),
    costCategory: asCostCategory(formData.get("costCategory") as string),
    defaultSetupMinutes: Number.parseFloat((formData.get("setupMinutes") as string) || "0"),
    defaultRunMinutes: Number.parseFloat((formData.get("runMinutes") as string) || "0"),
    defaultHourlyRateCents: eurosToCents(formData.get("rateEuros") as string),
  });

  revalidatePath(`/${orgSlug}/settings/calculator-templates`);
}

export async function deleteTemplate(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const templateId = formData.get("templateId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await templateService.delete(orgId, templateId);
  revalidatePath(`/${orgSlug}/settings/calculator-templates`);
}

export async function seedDachTemplates(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await templateService.seedDachDefaults(orgId);
  revalidatePath(`/${orgSlug}/settings/calculator-templates`);
}
