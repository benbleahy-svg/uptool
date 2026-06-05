import { type NextRequest, NextResponse } from "next/server";
import { db, orgs, rfqs } from "@uptool/db";
import { eq } from "drizzle-orm";
import { withOrgContext } from "@uptool/db";
import { sql } from "drizzle-orm";

interface PostmarkInboundPayload {
  To: string;
  From: string;
  FromName?: string;
  Subject?: string;
  MessageID: string;
}

if (process.env.NODE_ENV === "production" && !process.env.POSTMARK_INBOUND_WEBHOOK_SECRET) {
  console.warn(
    "[postmark-inbound] POSTMARK_INBOUND_WEBHOOK_SECRET is unset in production — inbound webhook will reject all requests (401).",
  );
}

function verifyWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.POSTMARK_INBOUND_WEBHOOK_SECRET;
  // Fail closed when the secret is unset, except in local dev where it's optional.
  if (!secret) return process.env.NODE_ENV === "development";
  const header = req.headers.get("x-postmark-signature") ?? req.headers.get("authorization");
  return header === secret;
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toAddress = payload.To?.toLowerCase().split(/[<> ,]/)[0]?.trim();
  if (!toAddress) {
    return NextResponse.json({ error: "Missing To address" }, { status: 400 });
  }

  const org = await db.query.orgs.findFirst({
    where: eq(orgs.forwardingAddress, toAddress),
  });

  if (!org) {
    // Not an error — just not our address; return 200 so Postmark doesn't retry
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Stub: IngestEmail job will be implemented in Epic 1
  // For now, create a bare RFQ row so the email isn't silently dropped
  await withOrgContext(org.id, async (tx) => {
    const [updated] = await tx
      .update(orgs)
      .set({ rfqCounter: sql`rfq_counter + 1` })
      .where(eq(orgs.id, org.id))
      .returning({ rfqCounter: orgs.rfqCounter });

    const rfqNumber = updated?.rfqCounter;
    if (!rfqNumber) throw new Error("Failed to increment RFQ counter");

    await tx.insert(rfqs).values({
      orgId: org.id,
      rfqNumber,
      subject: payload.Subject ?? null,
      source: "manual_forward",
      status: "new",
      receivedAt: new Date(),
    });
  });

  return NextResponse.json({ ok: true });
}
