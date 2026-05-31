import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@uptool/db";
import { resolveRfq } from "@/lib/resolve-rfq";
import { RfqOverview } from "./_components/RfqOverview";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
  searchParams: Promise<{ part?: string }>;
}

export default async function RfqDetailPage({ params, searchParams }: Props) {
  const [{ orgSlug, rfqId }, sp] = await Promise.all([params, searchParams]);

  if (sp.part) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[hsl(var(--muted-foreground))]">
        Part estimator — coming soon
      </div>
    );
  }

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await resolveRfq(org.id, rfqId);
  if (!rfq) notFound();

  const allMessages = rfq.threads.flatMap((t) => t.messages);
  const lastInbound =
    allMessages
      .filter((m) => m.direction === "inbound")
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0] ?? null;

  return (
    <RfqOverview
      rfqNumber={rfq.rfqNumber}
      quantityBreaks={rfq.quantityBreaks}
      lastEmail={lastInbound}
      attachments={rfq.attachments}
      parts={rfq.parts}
      orgSlug={orgSlug}
      rfqId={rfqId}
      rfqUuid={rfq.id}
      declinedAt={rfq.declinedAt?.toISOString() ?? null}
    />
  );
}
