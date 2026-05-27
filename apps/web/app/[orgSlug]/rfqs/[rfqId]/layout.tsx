import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@uptool/db";
import { rfqService } from "@uptool/services";
import { getTranslations } from "next-intl/server";
import { AssigneePicker } from "./assignee-picker";
import { QuantityBreaksEditor } from "./quantity-breaks-editor";
import { TabLink } from "./tab-link";

interface Props {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  estimated: "bg-yellow-100 text-yellow-800",
  quoted: "bg-orange-100 text-orange-800",
  sent: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  no_bid: "bg-gray-100 text-gray-600",
};

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

  // Fetch org members for assignee picker
  const memberships = await db.query.memberships.findMany({
    where: (m, { eq }) => eq(m.orgId, org.id),
    with: { user: true },
  });
  const members = memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
  }));

  const [tStatus, tNav, tRfq] = await Promise.all([
    getTranslations("rfqs.status"),
    getTranslations("rfqs.tabs"),
    getTranslations("rfqs"),
  ]);

  const tabs = [
    { href: `/${orgSlug}/rfqs/${rfqId}/thread`, label: tNav("thread") },
    { href: `/${orgSlug}/rfqs/${rfqId}/estimate`, label: tNav("estimate") },
    { href: `/${orgSlug}/rfqs/${rfqId}/quote`, label: tNav("quote") },
    { href: `/${orgSlug}/rfqs/${rfqId}/quote/send`, label: tNav("send") },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link
          href={`/${orgSlug}/rfqs`}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          ← RFQs
        </Link>
        <span className="text-[hsl(var(--muted-foreground))]">/</span>
        <h1 className="text-base font-semibold">
          #{rfq.rfqNumber}
          {rfq.subject ? ` — ${rfq.subject}` : ""}
          {rfq.customer ? ` · ${rfq.customer.name}` : ""}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[rfq.status] ?? ""}`}
        >
          {tStatus(rfq.status as Parameters<typeof tStatus>[0])}
        </span>
        <AssigneePicker
          orgSlug={orgSlug}
          rfqId={rfqId}
          currentAssigneeId={rfq.assigneeId ?? null}
          members={members}
        />
        <QuantityBreaksEditor
          orgSlug={orgSlug}
          rfqId={rfqId}
          quantityBreaks={rfq.quantityBreaks ?? [1, 10, 100]}
          label={tRfq("quantity_breaks")}
          hint={tRfq("quantity_breaks_hint")}
        />
      </div>

      {/* Tab nav */}
      <nav className="flex gap-1 border-b border-[hsl(var(--border))] mb-6">
        {tabs.map((tab) => (
          <TabLink key={tab.href} href={tab.href} label={tab.label} />
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}
