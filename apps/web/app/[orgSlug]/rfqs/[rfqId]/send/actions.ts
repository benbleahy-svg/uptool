"use server";

import { requireAuth } from "@/lib/auth";
import { renderQuoteDocPdf } from "@/lib/quoting/render-quote-pdf";
import { db } from "@uptool/db";
import { quoteService } from "@uptool/services";
import { revalidatePath } from "next/cache";

async function getOrgId(orgSlug: string, userId: string): Promise<string> {
  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) throw new Error("Org not found");
  const membership = await db.query.memberships.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, org.id), eq(m.userId, userId)),
  });
  if (!membership) throw new Error("Not a member");
  return org.id;
}

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
    return { ok: false, error: e instanceof Error ? e.message : "unexpected_error" };
  }
}

function revalidateAfterSend(orgSlug: string, rfqParam: string) {
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}/send`, "layout");
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}/quote`, "layout");
  revalidatePath(`/${orgSlug}/rfqs/${rfqParam}`);
  revalidatePath(`/${orgSlug}/rfqs`);
}

// Send (or re-send) the RFQ's current quote. Renders the DIN PDF server-side
// from persisted rows, then quoteService.sendQuote emails it + flips status. Any
// failure → { ok:false, error:'send_failed' } (locale map); never 500s.
export async function sendQuoteAction(i: {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  to: string;
  subject: string;
  body: string;
}) {
  return run(
    i.orgSlug,
    async (orgId, userId) => {
      const current = await quoteService.getCurrentQuote(orgId, i.rfqId);
      if (!current) throw new Error("send_failed");
      const pdf = await renderQuoteDocPdf(current.id);
      if (!pdf) throw new Error("send_failed");
      try {
        await quoteService.sendQuote(orgId, i.rfqId, {
          to: i.to,
          subject: i.subject,
          body: i.body,
          pdfBase64: pdf.buffer.toString("base64"),
          userId,
        });
      } catch (e) {
        console.error("[sendQuoteAction] send failed", e);
        throw new Error("send_failed");
      }
    },
    () => revalidateAfterSend(i.orgSlug, i.rfqParam),
  );
}

export async function createQuoteRevisionAction(i: {
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
}) {
  return run(
    i.orgSlug,
    (orgId, userId) => quoteService.createQuoteRevision(orgId, i.rfqId, userId),
    () => revalidateAfterSend(i.orgSlug, i.rfqParam),
  );
}
