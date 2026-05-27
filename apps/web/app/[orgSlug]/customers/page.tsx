import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { customerService } from "@uptool/services";
import { CustomerTable, type CustomerRow } from "./customer-table";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function CustomersPage({ params }: Props) {
  const { orgSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const customers = await customerService.findAll(org.id);
  const t = await getTranslations("customers");

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    contactCount: c.contactCount,
    openRfqCount: c.openRfqCount,
    lastRfqAt: c.lastRfqAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">{t("title")}</h1>
      </div>
      <CustomerTable
        data={rows}
        orgSlug={orgSlug}
        labels={{
          company: t("company"),
          domain: t("domain"),
          contacts: t("contacts_count"),
          openRfqs: t("open_rfqs"),
          lastRfq: t("last_rfq"),
          emptyTitle: t("no_customers"),
        }}
      />
    </div>
  );
}
