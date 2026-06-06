"use server";

import { db } from "@uptool/db";
import {
  type CreateOrgMaterialInput,
  type MaterialCategory,
  orgMaterialService,
} from "@uptool/services";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

async function run<T>(
  orgSlug: string,
  fn: (orgId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  const { userId } = await requireAuth();
  try {
    const orgId = await getOrgId(orgSlug, userId);
    const data = await fn(orgId);
    revalidatePath(`/${orgSlug}/settings/materials`);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

export async function addMaterial(input: {
  orgSlug: string;
  name: string;
  category: MaterialCategory;
  densityGCm3: number;
  priceEurPerKg: number;
}) {
  return run(input.orgSlug, (orgId) =>
    orgMaterialService.create({
      orgId,
      name: input.name,
      category: input.category,
      densityGCm3: input.densityGCm3,
      priceEurPerKg: input.priceEurPerKg,
    } satisfies CreateOrgMaterialInput),
  );
}

export async function updateMaterial(input: {
  orgSlug: string;
  materialId: string;
  name?: string;
  category?: MaterialCategory;
  densityGCm3?: number;
  priceEurPerKg?: number;
}) {
  const { orgSlug, materialId, ...patch } = input;
  return run(orgSlug, (orgId) => orgMaterialService.update(orgId, materialId, patch));
}

export async function markPriceUpdated(input: { orgSlug: string; materialId: string }) {
  return run(input.orgSlug, (orgId) =>
    orgMaterialService.markPriceUpdated(orgId, input.materialId),
  );
}

export async function deleteMaterial(input: { orgSlug: string; materialId: string }) {
  return run(input.orgSlug, (orgId) => orgMaterialService.delete(orgId, input.materialId));
}
