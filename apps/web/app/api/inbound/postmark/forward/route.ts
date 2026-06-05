import { db, orgs } from "@uptool/db";
import { type IngestPayload, emailIngestService } from "@uptool/services";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

interface PostmarkAttachment {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
}

interface PostmarkInboundPayload {
  From: string;
  FromName?: string;
  To: string;
  ToFull?: Array<{ Email: string }>;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID: string;
  Date?: string;
  Attachments?: PostmarkAttachment[];
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
  // Auth is checked before any payload processing (fail-closed).
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
    // Not an error — just not our address; return 200 so Postmark doesn't retry.
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Forwarding-address ingestion: no connected account (emailAccountId=null).
  // Postmark has no thread concept, so MessageID is used as the thread key —
  // each forwarded email starts its own thread. A forwarded *reply* therefore
  // creates a separate RFQ (acceptable limitation for the backup forwarding path).
  const ingest: IngestPayload = {
    orgId: org.id,
    emailAccountId: null,
    provider: "postmark",
    providerMessageId: payload.MessageID,
    providerThreadId: payload.MessageID,
    fromEmail: payload.From,
    fromName: payload.FromName,
    toEmails: (payload.ToFull ?? []).map((t) => t.Email),
    subject: payload.Subject,
    bodyText: payload.TextBody,
    receivedAt: payload.Date ? new Date(payload.Date) : new Date(),
    attachments: (payload.Attachments ?? []).map((a) => ({
      filename: a.Name,
      contentType: a.ContentType,
      sizeBytes: a.ContentLength,
      data: Buffer.from(a.Content, "base64"),
    })),
  };

  try {
    const result = await emailIngestService.ingestMessage(ingest);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // Surface ingest failures: log + 422 so Postmark retries (don't swallow).
    console.error("[postmark-inbound] ingest failed", err);
    const message = err instanceof Error ? err.message : "ingest_failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
