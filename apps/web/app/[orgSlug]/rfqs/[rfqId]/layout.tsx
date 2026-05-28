import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@uptool/db";
import { rfqService } from "@uptool/services";
import { RfqSecondarySidebar } from "./_components/RfqSecondarySidebar";

interface Props {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

export default async function RfqDetailLayout({ children, params }: Props) {
  const { orgSlug, rfqId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await rfqService.findById(org.id, rfqId);
  if (!rfq) notFound();

  return (
    <div className="flex h-full">
      <RfqSecondarySidebar
        rfqNumber={rfq.rfqNumber}
        companyName={rfq.customer?.name ?? null}
        contactName={rfq.contact?.name ?? null}
        contactEmail={rfq.contact?.email ?? null}
        parts={rfq.parts ?? []}
      />
      <div className="flex-1 min-w-0 overflow-auto bg-[hsl(210_20%_96%)]">
        {children}
      </div>
    </div>
  );
}
