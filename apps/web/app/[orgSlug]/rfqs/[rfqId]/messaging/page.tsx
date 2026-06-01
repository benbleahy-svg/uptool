import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@uptool/db";
import { emailTemplateService, rfqService } from "@uptool/services";
import { resolveRfq } from "@/lib/resolve-rfq";
import { renderTokens, tokensFromRfq } from "@/lib/email-tokens";
import { MessagingPage } from "./_components/MessagingPage";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
  searchParams: Promise<{ draft?: string }>;
}

export default async function MessagingRoute({ params, searchParams }: Props) {
  const { orgSlug, rfqId } = await params;
  const { draft } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await resolveRfq(org.id, rfqId);
  if (!rfq) notFound();

  // Opening the messaging view reads the thread — clear the dashboard unread badge.
  await rfqService.markEmailsRead(org.id, rfq.id);

  const messages = rfq.threads
    .flatMap((t) => t.messages)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

  // Pre-draft a decline reply when arrived via ?draft=decline (from the Decline
  // action or the "Notify customer of decline" affordance). Recipients come from
  // the thread (last inbound sender), falling back to the RFQ contact.
  let declineDraft: { to: string[]; subject: string; body: string } | null = null;
  if (draft === "decline") {
    const { decline } = await emailTemplateService.resolve(org.id);
    const tokens = tokensFromRfq({
      rfqNumber: rfq.rfqNumber,
      companyName: rfq.customer?.name ?? null,
      contactName: rfq.contact?.name ?? null,
    });
    const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
    const to = [lastInbound?.fromEmail ?? rfq.contact?.email].filter(
      (e): e is string => Boolean(e),
    );
    declineDraft = {
      to,
      subject: renderTokens(decline.subject, tokens),
      body: renderTokens(decline.body, tokens),
    };
  }

  return (
    <MessagingPage
      subject={rfq.subject}
      contactEmail={rfq.contact?.email ?? null}
      messages={messages}
      orgSlug={orgSlug}
      rfqLabel={rfq.rfqNumber}
      declineDraft={declineDraft}
    />
  );
}
