import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@uptool/db";
import { resolveRfq } from "@/lib/resolve-rfq";
import { MessagingPage } from "./_components/MessagingPage";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

export default async function MessagingRoute({ params }: Props) {
  const { orgSlug, rfqId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await resolveRfq(org.id, rfqId);
  if (!rfq) notFound();

  const messages = rfq.threads
    .flatMap((t) => t.messages)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

  return (
    <MessagingPage
      subject={rfq.subject}
      contactEmail={rfq.contact?.email ?? null}
      messages={messages}
    />
  );
}
