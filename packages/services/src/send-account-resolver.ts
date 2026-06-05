import { db, type emailAccounts } from "@uptool/db";

export type EmailAccount = typeof emailAccounts.$inferSelect;

/** Thrown by quoteService.sendQuote when no connected account can send. */
export class QuoteNoSendAccountError extends Error {
  constructor(message = "No connected email account available to send from") {
    super(message);
    this.name = "QuoteNoSendAccountError";
  }
}

/**
 * Resolve which connected email account to send an RFQ's quote from.
 * First match wins:
 *   1. Account owned by the sending user (owner_user_id=userId), connected.
 *      Tiebreak: prefer the one linked to the RFQ, else the first created.
 *   2. The RFQ's linked account (rfqs.email_account_id), connected.
 *   3. The org's default send account (is_default_send=true), connected.
 *   4. null → caller must block the send.
 * A missing userId simply skips step 1.
 */
export async function resolveSendAccount(
  orgId: string,
  rfqId: string,
  userId?: string,
): Promise<EmailAccount | null> {
  const rfq = await db.query.rfqs.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, rfqId), eq(r.orgId, orgId)),
    columns: { emailAccountId: true },
  });
  const rfqAccountId = rfq?.emailAccountId ?? null;

  // 1. Owned by the sending user.
  if (userId) {
    const owned = await db.query.emailAccounts.findMany({
      where: (a, { and, eq }) =>
        and(eq(a.orgId, orgId), eq(a.ownerUserId, userId), eq(a.status, "connected")),
      orderBy: (a, { asc }) => [asc(a.createdAt)],
    });
    const first = owned[0];
    if (first) {
      const linkedToRfq = rfqAccountId ? owned.find((a) => a.id === rfqAccountId) : undefined;
      return linkedToRfq ?? first;
    }
  }

  // 2. The RFQ's linked account.
  if (rfqAccountId) {
    const linked = await db.query.emailAccounts.findFirst({
      where: (a, { and, eq }) =>
        and(eq(a.id, rfqAccountId), eq(a.orgId, orgId), eq(a.status, "connected")),
    });
    if (linked) return linked;
  }

  // 3. Org default send account.
  const fallback = await db.query.emailAccounts.findFirst({
    where: (a, { and, eq }) =>
      and(eq(a.orgId, orgId), eq(a.isDefaultSend, true), eq(a.status, "connected")),
  });
  if (fallback) return fallback;

  // 4. None.
  return null;
}

/**
 * The deduped, chain-ordered list of accounts the user may send from: their own
 * (RFQ-linked first), then the RFQ-linked account, then the org default — all
 * connected. resolveSendAccount returns the first of this list; the UI uses the
 * full list for the "Sending from" override dropdown.
 */
export async function listSendableAccounts(
  orgId: string,
  rfqId: string,
  userId?: string,
): Promise<EmailAccount[]> {
  const rfq = await db.query.rfqs.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, rfqId), eq(r.orgId, orgId)),
    columns: { emailAccountId: true },
  });
  const rfqAccountId = rfq?.emailAccountId ?? null;

  const out: EmailAccount[] = [];
  const seen = new Set<string>();
  const push = (a?: EmailAccount | null) => {
    if (a && !seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  };

  if (userId) {
    const owned = await db.query.emailAccounts.findMany({
      where: (a, { and, eq }) =>
        and(eq(a.orgId, orgId), eq(a.ownerUserId, userId), eq(a.status, "connected")),
      orderBy: (a, { asc }) => [asc(a.createdAt)],
    });
    if (rfqAccountId) push(owned.find((a) => a.id === rfqAccountId));
    for (const a of owned) push(a);
  }

  if (rfqAccountId) {
    push(
      await db.query.emailAccounts.findFirst({
        where: (a, { and, eq }) =>
          and(eq(a.id, rfqAccountId), eq(a.orgId, orgId), eq(a.status, "connected")),
      }),
    );
  }

  push(
    await db.query.emailAccounts.findFirst({
      where: (a, { and, eq }) =>
        and(eq(a.orgId, orgId), eq(a.isDefaultSend, true), eq(a.status, "connected")),
    }),
  );

  return out;
}
