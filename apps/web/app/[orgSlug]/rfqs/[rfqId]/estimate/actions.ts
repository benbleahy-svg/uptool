"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@uptool/db";
import {
  type AddMaterialInput,
  type AddOperationInput,
  type NotesInput,
  type OverrideField,
  type QuoteBulkInput,
  type UpdateMaterialInput,
  type UpdateOperationInput,
  estimateService,
  partService,
  rfqService,
  templateService,
} from "@uptool/services";
import { revalidatePath } from "next/cache";

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

export async function setPartCompleted(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const partId = formData.get("partId") as string;
  const completed = formData.get("completed") === "true";
  const orgId = await getOrgId(orgSlug, userId);

  await partService.setCompleted(orgId, partId, completed);
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

// Reset the whole RFQ's estimate (every part) back to a fresh, just-imported
// state. Delegates to the services layer (single transaction); revalidates the
// estimate, quote, and RFQ routes so server-rendered views pick up the reset.
export async function resetEstimate(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqParam = formData.get("rfqParam") as string;
  const rfqId = formData.get("rfqId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  await rfqService.resetEstimate(orgId, rfqId);

  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}/estimate`, "layout");
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}/quote`, "layout");
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}`);
  revalidatePath(`/${orgSlug}/rfqs`);
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

// ─── Estimate-persistence actions (prompt 2) ─────────────────────────────────
// Typed-arg RPC server actions for the calculator write-path. Unlike the
// FormData/throwing handlers above, these return { ok, data } | { ok, error }
// and never throw across the network boundary (prompt 3 calls them directly).
// requireAuth() runs outside the try so its redirect (unauthed) still propagates.

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(
  orgSlug: string,
  fn: (orgId: string) => Promise<T>,
  revalidate?: () => void,
): Promise<ActionResult<T>> {
  const { userId } = await requireAuth();
  try {
    const orgId = await getOrgId(orgSlug, userId);
    const data = await fn(orgId);
    revalidate?.();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

function revalidateEstimate(orgSlug: string, rfqParam: string) {
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}/estimate`, "layout");
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}`);
}

// — Hydration —
export async function hydratePartEstimateAction(i: {
  orgSlug: string;
  rfqParam: string;
  partId: string;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.hydratePartEstimate(orgId, i.partId),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

// — Operations —
export async function listPartOperationsAction(i: { orgSlug: string; partId: string }) {
  return run(i.orgSlug, (orgId) => estimateService.listPartOperations(orgId, i.partId));
}

export async function addPartOperationAction(i: {
  orgSlug: string;
  rfqParam: string;
  partId: string;
  input: AddOperationInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.addPartOperation(orgId, i.partId, i.input),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function updatePartOperationAction(i: {
  orgSlug: string;
  rfqParam: string;
  operationId: string;
  patch: UpdateOperationInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.updatePartOperation(orgId, i.operationId, i.patch),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function deletePartOperationAction(i: {
  orgSlug: string;
  rfqParam: string;
  operationId: string;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.deletePartOperation(orgId, i.operationId),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function reorderPartOperationsAction(i: {
  orgSlug: string;
  rfqParam: string;
  partId: string;
  orderedIds: string[];
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.reorderPartOperations(orgId, i.partId, i.orderedIds),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function clearPartOperationOverrideAction(i: {
  orgSlug: string;
  rfqParam: string;
  operationId: string;
  field: OverrideField;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.clearPartOperationOverride(orgId, i.operationId, i.field),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

// — Materials —
export async function listPartMaterialsAction(i: { orgSlug: string; partId: string }) {
  return run(i.orgSlug, (orgId) => estimateService.listPartMaterials(orgId, i.partId));
}

export async function addPartMaterialAction(i: {
  orgSlug: string;
  rfqParam: string;
  partId: string;
  input: AddMaterialInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.addPartMaterial(orgId, i.partId, i.input),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function updatePartMaterialAction(i: {
  orgSlug: string;
  rfqParam: string;
  materialId: string;
  patch: UpdateMaterialInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.updatePartMaterial(orgId, i.materialId, i.patch),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function deletePartMaterialAction(i: {
  orgSlug: string;
  rfqParam: string;
  materialId: string;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.deletePartMaterial(orgId, i.materialId),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

export async function reorderPartMaterialsAction(i: {
  orgSlug: string;
  rfqParam: string;
  partId: string;
  orderedIds: string[];
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.reorderPartMaterials(orgId, i.partId, i.orderedIds),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

// — Notes —
export async function updatePartNotesAction(i: {
  orgSlug: string;
  rfqParam: string;
  partId: string;
  patch: NotesInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.updatePartNotes(orgId, i.partId, i.patch),
    () => revalidateEstimate(i.orgSlug, i.rfqParam),
  );
}

// — RFQ-level quote bulk —
export async function updateRfqQuoteBulkAction(i: {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  patch: QuoteBulkInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => estimateService.updateRfqQuoteBulk(orgId, i.rfqId, i.patch),
    () => {
      revalidateEstimate(i.orgSlug, i.rfqParam);
      revalidatePath(`/${i.orgSlug}/rfqs/${i.rfqParam}/quote`, "layout");
    },
  );
}
