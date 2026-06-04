"use server";

import { revalidatePath } from "next/cache";
import { db } from "@uptool/db";
import { requireAuth } from "@/lib/auth";
import {
  type AddQuoteLineItemInput,
  type UpdateQuoteLineItemInput,
  quoteService,
} from "@uptool/services";

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

export async function createOrUpdateQuote(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  // Parse line items from form: lineItems[i][field]
  const lineItemsRaw: Record<number, Record<string, string>> = {};
  for (const [key, val] of formData.entries()) {
    const m = key.match(/^lineItems\[(\d+)\]\[(\w+)\]$/);
    if (m) {
      const idx = Number(m[1]);
      const field = m[2] ?? "";
      if (!lineItemsRaw[idx]) lineItemsRaw[idx] = {};
      lineItemsRaw[idx][field] = val as string;
    }
  }

  const lineItems = Object.values(lineItemsRaw)
    .filter((li) => li.partId)
    .map((li) => ({
      partId: li.partId ?? "",
      quantity: Number(li.quantity ?? 1),
      costPerUnitCents: Number(li.costPerUnitCents ?? 0),
      markupPct: Number.parseFloat(li.markupPct ?? "30"),
      leadTimeWeeks: li.leadTimeWeeks ? Number(li.leadTimeWeeks) : undefined,
      isNoBid: li.isNoBid === "true",
    }));

  await quoteService.createOrUpdate({
    orgId,
    rfqId,
    userId,
    notesForCustomer: (formData.get("notesForCustomer") as string) || undefined,
    lineItems,
  });

  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/quote`);
}

export async function sendQuote(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const quoteId = formData.get("quoteId") as string;
  const orgId = await getOrgId(orgSlug, userId);

  const toEmail = formData.get("toEmail") as string;
  const subject = formData.get("subject") as string;
  const bodyText = formData.get("bodyText") as string;

  // Fetch PDF bytes from our own API route
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const pdfRes = await fetch(`${baseUrl}/api/quotes/${quoteId}/pdf`, {
    headers: { Cookie: "" }, // PDF route doesn't need auth (quoteId is a secret)
  });

  if (!pdfRes.ok) throw new Error("Failed to generate PDF");
  const pdfBuffer = await pdfRes.arrayBuffer();
  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

  // Send via Resend
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const quote = await quoteService.findById(orgId, quoteId);
  if (!quote) throw new Error("Quote not found");

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "noreply@localhost",
    to: [toEmail],
    subject,
    text: bodyText,
    attachments: [
      {
        filename: `Quote-${quote.quoteNumber}.pdf`,
        content: pdfBase64,
      },
    ],
  });

  await quoteService.markSent(orgId, quoteId);
  revalidatePath(`/${orgSlug}/rfqs/${rfqId}/quote/send`);
}

// ─── Quote line-item tier actions (prompt 2) ─────────────────────────────────
// Typed-arg RPC actions returning { ok, data } | { ok, error } — the same
// contract as the estimate epic. Replicated here (not imported) because that
// file's run/ActionResult are internal to a "use server" module. prompt 3 wires
// these to the quote UI; the page still renders from mock until then.

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(
  orgSlug: string,
  fn: (orgId: string, userId: string) => Promise<T>,
  revalidate?: () => void,
): Promise<ActionResult<T>> {
  const { userId } = await requireAuth();
  try {
    const orgId = await getOrgId(orgSlug, userId);
    const data = await fn(orgId, userId);
    revalidate?.();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}

function revalidateQuote(orgSlug: string, rfqParam: string) {
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}/quote`, "layout");
}

export async function listQuoteLineItemsAction(i: { orgSlug: string; rfqId: string }) {
  return run(i.orgSlug, (orgId) => quoteService.listQuoteLineItems(orgId, i.rfqId));
}

export async function addQuoteLineItemAction(i: {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  input: AddQuoteLineItemInput;
}) {
  return run(
    i.orgSlug,
    (orgId, userId) => quoteService.addQuoteLineItem(orgId, i.rfqId, i.input, userId),
    () => revalidateQuote(i.orgSlug, i.rfqParam),
  );
}

export async function duplicateQuoteLineItemAction(i: {
  orgSlug: string;
  rfqParam: string;
  lineItemId: string;
}) {
  return run(
    i.orgSlug,
    (orgId) => quoteService.duplicateQuoteLineItem(orgId, i.lineItemId),
    () => revalidateQuote(i.orgSlug, i.rfqParam),
  );
}

export async function updateQuoteLineItemAction(i: {
  orgSlug: string;
  rfqParam: string;
  lineItemId: string;
  patch: UpdateQuoteLineItemInput;
}) {
  return run(
    i.orgSlug,
    (orgId) => quoteService.updateQuoteLineItem(orgId, i.lineItemId, i.patch),
    () => revalidateQuote(i.orgSlug, i.rfqParam),
  );
}

export async function deleteQuoteLineItemAction(i: {
  orgSlug: string;
  rfqParam: string;
  lineItemId: string;
}) {
  return run(
    i.orgSlug,
    (orgId) => quoteService.deleteQuoteLineItem(orgId, i.lineItemId),
    () => revalidateQuote(i.orgSlug, i.rfqParam),
  );
}

export async function reorderQuoteLineItemsAction(i: {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  orderedIds: string[];
}) {
  return run(
    i.orgSlug,
    (orgId) => quoteService.reorderQuoteLineItems(orgId, i.rfqId, i.orderedIds),
    () => revalidateQuote(i.orgSlug, i.rfqParam),
  );
}

export async function updateQuoteNotesAction(i: {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  notesForCustomer: string;
}) {
  return run(
    i.orgSlug,
    (orgId, userId) => quoteService.updateQuoteNotes(orgId, i.rfqId, i.notesForCustomer, userId),
    () => revalidateQuote(i.orgSlug, i.rfqParam),
  );
}
