import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { customerService, storageService } from "@uptool/services";
import { CustomerTable, type CustomerRow } from "./customer-table";
import { createCompany } from "./actions";

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

  const [customers, locale, orgLogoUrl, t] = await Promise.all([
    customerService.findAll(org.id),
    getLocale(),
    org.logoUrl ? storageService.presignedUrl(org.logoUrl, 3600) : Promise.resolve(null),
    getTranslations("customers"),
  ]);

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    contactCount: c.contactCount,
    contactEmails: c.contactEmails,
    rfqCount: c.rfqCount,
    lastRfqAt: c.lastRfqAt?.toISOString() ?? null,
  }));

  return (
    <CustomerTable
      data={rows}
      orgSlug={orgSlug}
      orgName={org.name}
      orgLogoUrl={orgLogoUrl}
      locale={locale}
      onCreateCompany={createCompany}
      labels={{
        title: t("title"),
        company: t("company"),
        emailDomain: t("email_domain"),
        contacts: t("contacts_count"),
        rfqs: t("rfqs"),
        lastRfq: t("last_rfq"),
        emptyTitle: t("no_customers"),
        noFilterResults: t("no_filter_results"),
        searchPlaceholder: t("search_placeholder"),
        exportContacts: t("export_contacts"),
        addCompany: t("add_company"),
        addCompanyName: t("add_company_name"),
        addCompanyNamePlaceholder: t("add_company_name_placeholder"),
        addCompanyDomain: t("add_company_domain"),
        addCompanyDomainPlaceholder: t("add_company_domain_placeholder"),
        addCompanyCreate: t("add_company_create"),
        flaggedTooltip: t("flagged_tooltip"),
        actionView: t("action_view"),
        actionDelete: t("action_delete"),
      }}
    />
  );
}
