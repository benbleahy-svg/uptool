import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { rfqService, memberService } from "@uptool/services";
import { RfqTable, type RfqRow } from "./rfq-table";
import { createManualRfq } from "./actions";

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

  const [rfqs, members] = await Promise.all([
    rfqService.findByOrg(org.id),
    memberService.listForOrg(org.id),
  ]);

  const rows: RfqRow[] = rfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    companyName: r.customer?.name ?? "—",
    contactEmail: r.contact?.email ?? null,
    subject: r.subject ?? null,
    status: r.status,
    receivedAt: r.receivedAt.toISOString(),
    lastEmailAt: r.lastEmailAt?.toISOString() ?? null,
    assigneeName: r.assignee?.name ?? null,
    assigneeId: r.assigneeId ?? null,
    attachmentCount: r.attachments.length,
  }));

  const [tTable, tStatus, tDash, tRfq, tCommon] = await Promise.all([
    getTranslations("rfqs.table"),
    getTranslations("rfqs.status"),
    getTranslations("dashboard.empty"),
    getTranslations("rfqs"),
    getTranslations("common"),
  ]);

  return (
    <div className="flex flex-col h-full">
      <RfqTable
        data={rows}
        orgSlug={orgSlug}
        members={members}
        forwardingAddress={org.forwardingAddress ?? null}
        onCreateRfq={createManualRfq}
        labels={{
          title: tRfq("title"),
          searchPlaceholder: tRfq("search_placeholder"),
          forwardingAddress: tRfq("forwarding_address"),
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
          assignee: tTable("assignee"),
          assignPlaceholder: tRfq("assign_placeholder"),
          assignSearch: tRfq("assign_search"),
          assignUnassigned: tRfq("assign_unassigned"),
          assignEmpty: tRfq("assign_empty"),
          kebabNoBid: tRfq("kebab_no_bid"),
          kebabArchive: tRfq("kebab_archive"),
          kebabDelete: tRfq("kebab_delete"),
          kebabComingSoon: tCommon("coming_soon"),
          emptyTitle: tDash("title"),
          emptySubtitle: tDash("subtitle"),
          noFilterResults: tRfq("no_filter_results"),
          bulkNoBid: tRfq("bulk_no_bid"),
          bulkSelected: tRfq("bulk_selected"),
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
          won: tStatus("won"),
          lost: tStatus("lost"),
          no_bid: tStatus("no_bid"),
        }}
      />
    </div>
  );
}
