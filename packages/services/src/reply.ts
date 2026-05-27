import { db, emailMessages, emailThreads, rfqs } from "@uptool/db";
import { and, eq } from "drizzle-orm";

export interface RecordOutboundInput {
  orgId: string;
  rfqId: string;
  providerMessageId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
}

export const replyService = {
  /** Resolves the from-address: first active email account or env fallback. */
  async resolveFromEmail(orgId: string): Promise<string> {
    const account = await db.query.emailAccounts.findFirst({
      where: (ea, { and, eq }) =>
        and(eq(ea.orgId, orgId), eq(ea.status, "connected")),
      orderBy: (ea, { asc }) => [asc(ea.createdAt)],
    });
    return account?.email ?? process.env.RESEND_FROM_EMAIL ?? "noreply@localhost";
  },

  /** Inserts an outbound message into the thread and updates rfq.lastEmailAt. */
  async recordOutbound(input: RecordOutboundInput): Promise<{ messageId: string }> {
    const { orgId, rfqId, providerMessageId, fromEmail, toEmail, subject, bodyText } = input;

    // Find or create a thread for this RFQ
    let thread = await db.query.emailThreads.findFirst({
      where: (t, { eq }) => eq(t.rfqId, rfqId),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });

    if (!thread) {
      const [newThread] = await db
        .insert(emailThreads)
        .values({
          orgId,
          rfqId,
          providerThreadId: `manual-${rfqId}`,
          provider: "manual",
        })
        .returning();
      if (!newThread) throw new Error("Failed to create thread");
      thread = newThread;
    }

    const [msg] = await db
      .insert(emailMessages)
      .values({
        orgId,
        threadId: thread.id,
        providerMessageId,
        direction: "outbound",
        fromEmail,
        toEmails: [toEmail],
        subject,
        bodyText,
        receivedAt: new Date(),
      })
      .returning();

    if (!msg) throw new Error("Failed to record outbound message");

    await db
      .update(rfqs)
      .set({ lastEmailAt: new Date(), updatedAt: new Date() })
      .where(and(eq(rfqs.id, rfqId), eq(rfqs.orgId, orgId)));

    return { messageId: msg.id };
  },
};
