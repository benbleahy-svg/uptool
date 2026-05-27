import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { rfqService } from "@uptool/services";
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

  const rfqs = await rfqService.findByOrg(org.id);

  const rows: RfqRow[] = rfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    customerName: r.customer?.name ?? r.contact?.email ?? "—",
    subject: r.subject ?? null,
    status: r.status,
    receivedAt: r.receivedAt.toISOString(),
    assigneeName: r.assignee?.name ?? null,
    assigneeId: r.assigneeId ?? null,
    attachmentCount: r.attachments.length,
  }));

  const userId = session.user.id;

  const [tTable, tStatus, tDash, tRfq] = await Promise.all([
    getTranslations("rfqs.table"),
    getTranslations("rfqs.status"),
    getTranslations("dashboard.empty"),
    getTranslations("rfqs"),
  ]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">{tRfq("title")}</h1>
        <NewRfqButton
          orgSlug={orgSlug}
          label={tRfq("new_rfq")}
          labels={{
            subject: tRfq("new_rfq_subject"),
            subjectPlaceholder: tRfq("new_rfq_subject_placeholder"),
            customerEmail: tRfq("new_rfq_customer_email"),
            customerName: tRfq("new_rfq_customer_name"),
            create: tRfq("new_rfq_create"),
          }}
        />
      </div>

      <RfqTable
        data={rows}
        orgSlug={orgSlug}
        currentUserId={userId}
        labels={{
          number: tTable("number"),
          customer: tTable("customer"),
          subject: tTable("subject"),
          status: tTable("status"),
          received: tTable("received"),
          assignee: tTable("assignee"),
          emptyTitle: tDash("title"),
          emptySubtitle: tDash("subtitle"),
          searchPlaceholder: tRfq("search_placeholder"),
          filterAllStatuses: tRfq("filter_all_statuses"),
          filterMine: tRfq("filter_mine"),
          noFilterResults: tRfq("no_filter_results"),
          bulkNoBid: tRfq("bulk_no_bid"),
          bulkSelected: tRfq("bulk_selected"),
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

function NewRfqButton({
  orgSlug,
  label,
  labels,
}: {
  orgSlug: string;
  label: string;
  labels: {
    subject: string;
    subjectPlaceholder: string;
    customerEmail: string;
    customerName: string;
    create: string;
  };
}) {
  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90 inline-flex items-center gap-1">
        + {label}
      </summary>
      <div className="absolute right-0 top-full mt-1 z-10 w-80 rounded-md border border-[hsl(var(--border))] bg-white shadow-md p-4">
        <form action={createManualRfq} className="space-y-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <div>
            <label htmlFor="new-rfq-subject" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.subject}
            </label>
            <input
              id="new-rfq-subject"
              name="subject"
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm"
              placeholder={labels.subjectPlaceholder}
            />
          </div>
          <div>
            <label htmlFor="new-rfq-email" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.customerEmail}
            </label>
            <input
              id="new-rfq-email"
              name="fromEmail"
              type="email"
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-rfq-name" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {labels.customerName}
            </label>
            <input
              id="new-rfq-name"
              name="fromName"
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {labels.create}
          </button>
        </form>
      </div>
    </details>
  );
}
