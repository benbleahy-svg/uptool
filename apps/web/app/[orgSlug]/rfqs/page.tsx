import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { rfqService, memberService, storageService } from "@uptool/services";
import { RfqTable, type RfqRow } from "./rfq-table";
import { createManualRfq } from "./actions";
import { ensureThumbnails } from "@/lib/cad-thumbnail-queue";
import { getRfqStatus } from "@/lib/rfq-status";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function RfqsPage({ params }: Props) {
  const { orgSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const [rfqs, members, locale, orgLogoUrl] = await Promise.all([
    rfqService.findByOrg(org.id),
    memberService.listForOrg(org.id),
    getLocale(),
    org.logoUrl ? storageService.presignedUrl(org.logoUrl, 3600) : Promise.resolve(null),
  ]);

  // Kick off any missing/failed CAD thumbnail renders off the request path.
  // Idempotent; never block the dashboard if Redis is unavailable.
  await ensureThumbnails(org.id).catch(() => {});

  // Presign thumbnails for parts that have a ready render (mirrors the org-logo
  // precedent above). Done once across all rows to cap presign calls.
  const readyKeys = [
    ...new Set(
      rfqs.flatMap((r) =>
        r.parts.filter((p) => p.thumbnailStatus === "ready" && p.thumbnailKey).map((p) => p.thumbnailKey as string),
      ),
    ),
  ];
  const thumbUrlByKey = new Map(
    await Promise.all(
      readyKeys.map(
        async (key) => [key, await storageService.presignedUrl(key, 3600)] as const,
      ),
    ),
  );

  const rows: RfqRow[] = rfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    companyName: r.customer?.name ?? "—",
    contactName: r.contact?.name ?? null,
    contactEmail: r.contact?.email ?? null,
    subject: r.subject ?? null,
    status: getRfqStatus({ status: r.status, declinedAt: r.declinedAt, parts: r.parts }),
    viewed: r.firstViewedAt != null,
    unreadEmailCount: r.unreadEmailCount,
    quoteSentAt:
      r.quotes
        .filter((q) => q.status === "sent" && q.sentAt)
        .sort((a, b) => (b.sentAt as Date).getTime() - (a.sentAt as Date).getTime())[0]
        ?.sentAt?.toISOString() ?? null,
    receivedAt: r.receivedAt.toISOString(),
    lastEmailAt: r.lastEmailAt?.toISOString() ?? null,
    assigneeName: r.assignee?.name ?? null,
    assigneeId: r.assigneeId ?? null,
    partCount: r.parts.length,
    parts: r.parts.map((p) => ({
      status: p.thumbnailStatus,
      url: p.thumbnailKey ? (thumbUrlByKey.get(p.thumbnailKey) ?? null) : null,
      noBid: p.isNoBid,
      estimated: p.estimateCompletedAt != null,
    })),
  }));

  const [tTable, tStatus, tDash, tRfq, tCommon, tDate] = await Promise.all([
    getTranslations("rfqs.table"),
    getTranslations("rfqs.status"),
    getTranslations("dashboard.empty"),
    getTranslations("rfqs"),
    getTranslations("common"),
    getTranslations("date"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <RfqTable
        data={rows}
        orgSlug={orgSlug}
        orgName={org.name}
        orgLogoUrl={orgLogoUrl}
        members={members}
        locale={locale}
        forwardingAddress={org.forwardingAddress ?? null}
        onCreateRfq={createManualRfq}
        labels={{
          title: tRfq("title"),
          searchPlaceholder: tRfq("search_placeholder"),
          forwardingAddress: tRfq("forwarding_address"),
          forwardingLabel: tRfq("forwarding_label"),
          forwardingCopyConfirm: tRfq("forwarding_copy_confirm"),
          forwardingTooltip: tRfq("forwarding_tooltip"),
          newRfq: tRfq("new_rfq"),
          number: tTable("number"),
          company: tTable("company"),
          contact: tTable("contact"),
          parts: tTable("parts"),
          status: tTable("status"),
          dateReceived: tTable("date_received"),
          lastEmail: tTable("last_email"),
          unreadEmailOne: tTable("unread_email_one"),
          unreadEmailOther: tTable("unread_email_other"),
          dateToday: tDate("today"),
          dateYesterday: tDate("yesterday"),
          dateAgo: tDate.raw("ago"),
          dateAgoPlural: tDate.raw("ago_plural"),
          assignee: tTable("assignee"),
          assignPlaceholder: tRfq("assign_placeholder"),
          assignSearch: tRfq("assign_search"),
          assignUnassigned: tRfq("assign_unassigned"),
          assignEmpty: tRfq("assign_empty"),
          kebabDecline: tRfq("kebab_decline"),
          kebabDeclineConfirm: tRfq("kebab_decline_confirm"),
          kebabArchive: tRfq("kebab_archive"),
          kebabDelete: tRfq("kebab_delete"),
          kebabComingSoon: tCommon("coming_soon"),
          emptyTitle: tDash("title"),
          emptySubtitle: tDash("subtitle"),
          noFilterResults: tRfq("no_filter_results"),
          newRfqSubject: tRfq("new_rfq_subject"),
          newRfqSubjectPlaceholder: tRfq("new_rfq_subject_placeholder"),
          newRfqCustomerEmail: tRfq("new_rfq_customer_email"),
          newRfqCustomerName: tRfq("new_rfq_customer_name"),
          newRfqCreate: tRfq("new_rfq_create"),
        }}
        statusLabels={{
          new: tStatus("new"),
          estimated: tStatus("estimated"),
          quoted: tStatus("quoted"),
          sent: tStatus("sent"),
          declined: tStatus("declined"),
        }}
      />
    </div>
  );
}
