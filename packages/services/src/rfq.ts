import { attachments, auditLog, db, emailMessages, emailThreads, orgs, rfqs } from "@uptool/db";
import { isManufacturingFile } from "@uptool/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { customerService } from "./customer";
import { storageService } from "./storage";
import { withOrgContext } from "@uptool/db";

export interface CreateRfqFromEmailInput {
  orgId: string;
  emailAccountId: string;
  provider: "microsoft" | "gmail";
  providerThreadId: string;
  providerMessageId: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  subject?: string;
  bodyText?: string;
  receivedAt: Date;
  attachmentFiles: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    data: Buffer;
  }>;
}

export const rfqService = {
  async createFromEmail(input: CreateRfqFromEmailInput) {
    return withOrgContext(input.orgId, async (tx) => {
      // Increment RFQ counter atomically
      const [updated] = await tx
        .update(orgs)
        .set({ rfqCounter: sql`rfq_counter + 1` })
        .where(eq(orgs.id, input.orgId))
        .returning({ rfqCounter: orgs.rfqCounter });

      const rfqNumber = updated?.rfqCounter;
      if (!rfqNumber) throw new Error("Failed to increment RFQ counter");

      // Resolve customer/contact (pass bodyText for signature-based name derivation)
      const { customerId, contactId } = await customerService.findOrCreate(
        tx as typeof db,
        input.orgId,
        input.fromEmail,
        input.fromName,
        input.bodyText,
      );

      // Create RFQ
      const [rfq] = await tx
        .insert(rfqs)
        .values({
          orgId: input.orgId,
          rfqNumber,
          customerId,
          contactId,
          emailAccountId: input.emailAccountId,
          subject: input.subject,
          status: "new",
          receivedAt: input.receivedAt,
          lastEmailAt: input.receivedAt,
        })
        .returning();

      if (!rfq) throw new Error("Failed to create RFQ");

      // Create email thread
      const [thread] = await tx
        .insert(emailThreads)
        .values({
          orgId: input.orgId,
          rfqId: rfq.id,
          providerThreadId: input.providerThreadId,
          provider: input.provider,
        })
        .returning();

      if (!thread) throw new Error("Failed to create email thread");

      // Create email message
      const [message] = await tx
        .insert(emailMessages)
        .values({
          orgId: input.orgId,
          threadId: thread.id,
          providerMessageId: input.providerMessageId,
          direction: "inbound",
          fromEmail: input.fromEmail,
          fromName: input.fromName,
          toEmails: input.toEmails,
          subject: input.subject,
          bodyText: input.bodyText,
          receivedAt: input.receivedAt,
        })
        .returning();

      if (!message) throw new Error("Failed to create email message");

      // Upload attachments to S3 and record in DB
      for (const file of input.attachmentFiles) {
        if (!isManufacturingFile(file.filename)) continue;
        const storageKey = `${input.orgId}/${rfq.id}/${file.filename}`;
        await storageService.upload(storageKey, file.data, file.contentType);
        await tx.insert(attachments).values({
          orgId: input.orgId,
          rfqId: rfq.id,
          messageId: message.id,
          filename: file.filename,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          storageKey,
        });
      }

      // Audit log
      await tx.insert(auditLog).values({
        orgId: input.orgId,
        entity: "rfq",
        entityId: rfq.id,
        action: "created",
      });

      return rfq;
    });
  },

  async addMessageToThread(input: {
    orgId: string;
    threadId: string;
    rfqId: string;
    providerMessageId: string;
    fromEmail: string;
    fromName?: string;
    toEmails: string[];
    subject?: string;
    bodyText?: string;
    receivedAt: Date;
  }) {
    return withOrgContext(input.orgId, async (tx) => {
      const [message] = await tx
        .insert(emailMessages)
        .values({
          orgId: input.orgId,
          threadId: input.threadId,
          providerMessageId: input.providerMessageId,
          direction: "inbound",
          fromEmail: input.fromEmail,
          fromName: input.fromName,
          toEmails: input.toEmails,
          subject: input.subject,
          bodyText: input.bodyText,
          receivedAt: input.receivedAt,
        })
        .returning();

      await tx
        .update(rfqs)
        .set({ lastEmailAt: input.receivedAt, updatedAt: new Date() })
        .where(and(eq(rfqs.id, input.rfqId), eq(rfqs.orgId, input.orgId)));

      return message;
    });
  },

  async findByOrg(orgId: string) {
    return withOrgContext(orgId, async (tx) => {
      return tx.query.rfqs.findMany({
        where: (r, { eq }) => eq(r.orgId, orgId),
        with: {
          customer: true,
          contact: true,
          assignee: true,
          attachments: true,
          parts: {
            columns: { id: true, thumbnailKey: true, thumbnailStatus: true, sortOrder: true },
            orderBy: (p, { asc }) => [asc(p.sortOrder), asc(p.createdAt)],
          },
        },
        orderBy: (r, { desc }) => [desc(r.receivedAt)],
        limit: 50,
      });
    });
  },

  async findByNumber(orgId: string, rfqNumber: number) {
    return withOrgContext(orgId, async (tx) => {
      return tx.query.rfqs.findFirst({
        where: (r, { and, eq }) => and(eq(r.orgId, orgId), eq(r.rfqNumber, rfqNumber)),
        with: {
          customer: true,
          contact: true,
          assignee: true,
          emailAccount: true,
          attachments: true,
          parts: {
            columns: { id: true, partNumber: true, revision: true, description: true, material: true, processType: true, sortOrder: true },
            orderBy: (p, { asc }) => [asc(p.sortOrder)],
          },
          threads: {
            with: {
              messages: {
                orderBy: (m, { asc }) => [asc(m.receivedAt)],
                with: { attachments: true },
              },
            },
          },
        },
      });
    });
  },

  async findById(orgId: string, rfqId: string) {
    return withOrgContext(orgId, async (tx) => {
      return tx.query.rfqs.findFirst({
        where: (r, { and, eq }) => and(eq(r.orgId, orgId), eq(r.id, rfqId)),
        with: {
          customer: true,
          contact: true,
          assignee: true,
          emailAccount: true,
          attachments: true,
          parts: {
            columns: { id: true, partNumber: true, revision: true, description: true, material: true, processType: true, sortOrder: true },
            orderBy: (p, { asc }) => [asc(p.sortOrder)],
          },
          threads: {
            with: {
              messages: {
                orderBy: (m, { asc }) => [asc(m.receivedAt)],
                with: { attachments: true },
              },
            },
          },
        },
      });
    });
  },

  async updateAssignee(orgId: string, rfqId: string, assigneeId: string | null) {
    return withOrgContext(orgId, async (tx) => {
      await tx
        .update(rfqs)
        .set({ assigneeId, updatedAt: new Date() })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));
    });
  },

  async assign(
    orgId: string,
    actingUserId: string,
    rfqId: string,
    assigneeUserId: string | null,
  ) {
    return withOrgContext(orgId, async (tx) => {
      const [actingMembership, rfq] = await Promise.all([
        tx.query.memberships.findFirst({
          where: (m, { and, eq }) => and(eq(m.orgId, orgId), eq(m.userId, actingUserId)),
        }),
        tx.query.rfqs.findFirst({
          where: (r, { and, eq }) => and(eq(r.id, rfqId), eq(r.orgId, orgId)),
        }),
      ]);
      if (!actingMembership) throw new Error("UNAUTHORIZED");
      if (!rfq) throw new Error("RFQ_NOT_FOUND");

      if (assigneeUserId) {
        const assigneeMembership = await tx.query.memberships.findFirst({
          where: (m, { and, eq }) => and(eq(m.orgId, orgId), eq(m.userId, assigneeUserId)),
        });
        if (!assigneeMembership) throw new Error("ASSIGNEE_NOT_MEMBER");
      }

      await tx
        .update(rfqs)
        .set({ assigneeId: assigneeUserId, updatedAt: new Date() })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));

      await tx.insert(auditLog).values({
        orgId,
        userId: actingUserId,
        entity: "rfq",
        entityId: rfqId,
        action: "assign",
        diffJsonb: { from: rfq.assigneeId, to: assigneeUserId },
      });
    });
  },

  async updateQuantityBreaks(orgId: string, rfqId: string, quantities: number[]) {
    return withOrgContext(orgId, async (tx) => {
      await tx
        .update(rfqs)
        .set({ quantityBreaks: quantities, updatedAt: new Date() })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));
    });
  },

  async updateStatus(
    orgId: string,
    rfqId: string,
    status: "new" | "estimated" | "quoted" | "sent" | "won" | "lost" | "no_bid",
  ) {
    return withOrgContext(orgId, async (tx) => {
      await tx
        .update(rfqs)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));
    });
  },

  async advanceToEstimated(orgId: string, rfqId: string) {
    await db
      .update(rfqs)
      .set({ status: "estimated", updatedAt: new Date() })
      .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId), eq(rfqs.status, "new")));
  },

  async bulkUpdateStatus(
    orgId: string,
    rfqIds: string[],
    status: "new" | "estimated" | "quoted" | "sent" | "won" | "lost" | "no_bid",
  ) {
    if (rfqIds.length === 0) return;
    await db
      .update(rfqs)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(rfqs.orgId, orgId), inArray(rfqs.id, rfqIds)));
  },
};
