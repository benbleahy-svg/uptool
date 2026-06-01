"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, rfqs, customers, contacts, orgs } from "@uptool/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { withOrgContext } from "@uptool/db";
import { rfqService } from "@uptool/services";

export async function createManualRfq(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const subject = formData.get("subject") as string;
  const fromEmail = formData.get("fromEmail") as string;
  const fromName = formData.get("fromName") as string;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) throw new Error("Org not found");

  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");

  const rfq = await withOrgContext(org.id, async (tx) => {
    const [updated] = await tx
      .update(orgs)
      .set({ rfqCounter: sql`rfq_counter + 1` })
      .where(sql`id = ${org.id}`)
      .returning({ rfqCounter: orgs.rfqCounter });

    const rfqNumber = updated?.rfqCounter;
    if (!rfqNumber) throw new Error("Failed to increment counter");

    // Upsert customer by domain
    const domain = fromEmail.includes("@") ? fromEmail.split("@")[1] : null;
    let customerId: string | null = null;
    let contactId: string | null = null;

    if (fromEmail) {
      // Find existing contact
      const existingContact = await tx.query.contacts.findFirst({
        where: (c, { and, eq }) => and(eq(c.orgId, org.id), eq(c.email, fromEmail.toLowerCase())),
      });

      if (existingContact) {
        contactId = existingContact.id;
        customerId = existingContact.customerId;
      } else {
        // Create customer from domain or name
        const customerName = fromName || (domain ? domain.split(".")[0] ?? fromEmail : fromEmail);
        const [customer] = await tx
          .insert(customers)
          .values({ orgId: org.id, name: customerName, domain })
          .returning();
        customerId = customer?.id ?? null;

        const [contact] = await tx
          .insert(contacts)
          .values({
            orgId: org.id,
            customerId,
            email: fromEmail.toLowerCase(),
            name: fromName || null,
          })
          .returning();
        contactId = contact?.id ?? null;
      }
    }

    const [newRfq] = await tx
      .insert(rfqs)
      .values({
        orgId: org.id,
        rfqNumber,
        customerId,
        contactId,
        subject: subject || null,
        status: "new",
        receivedAt: new Date(),
        assigneeId: userId,
      })
      .returning();

    if (!newRfq) throw new Error("Failed to create RFQ");
    return newRfq;
  });

  redirect(`/${orgSlug}/rfqs/${rfq.rfqNumber}/estimate`);
}

export async function updateRfqStatus(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const status = formData.get("status") as
    | "new"
    | "estimated"
    | "quoted"
    | "sent"
    | "no_bid";

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");

  await rfqService.updateStatus(org.id, rfqId, status);
  revalidatePath(`/${orgSlug}/rfqs`);
  redirect(`/${orgSlug}/rfqs`);
}

/**
 * Decline (No Bid) a whole RFQ. Shared by both entry points: the RFQ overview
 * "No Bid RFQ" button and the dashboard row actions menu. Sets the explicit
 * decline flag; revalidates the list + overview without redirecting so the
 * caller's page updates in place.
 */
export async function declineRfq(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const reason = (formData.get("reason") as string) || undefined;

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");

  await rfqService.decline(org.id, rfqId, reason);
  revalidatePath(`/${orgSlug}/rfqs`, "layout");
}

export async function assignRfq(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const rfqId = formData.get("rfqId") as string;
  const assigneeUserId = (formData.get("assigneeUserId") as string) || null;

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");

  await rfqService.assign(org.id, userId, rfqId, assigneeUserId);
  revalidatePath(`/${orgSlug}/rfqs`);
}

export async function bulkUpdateRfqStatus(formData: FormData) {
  const { userId } = await requireAuth();
  const orgSlug = formData.get("orgSlug") as string;
  const status = formData.get("status") as
    | "new"
    | "estimated"
    | "quoted"
    | "sent"
    | "no_bid";
  const rfqIds = formData.getAll("rfqIds") as string[];

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");

  await rfqService.bulkUpdateStatus(org.id, rfqIds, status);
  revalidatePath(`/${orgSlug}/rfqs`);
}
