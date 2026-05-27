import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { GeneralForm } from "./general-form";
import { saveGeneralSettings } from "./actions";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

interface AddressJsonb {
  street?: string;
  city?: string;
  postal?: string;
  country?: string;
}

export default async function GeneralSettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const addr = (org.addressJsonb ?? {}) as AddressJsonb;
  const t = await getTranslations("settings.shop");

  const initial = {
    name: org.name,
    vatId: org.vatId ?? "",
    phone: org.phone ?? "",
    website: org.website ?? "",
    street: addr.street ?? "",
    postal: addr.postal ?? "",
    city: addr.city ?? "",
    country: (addr.country ?? org.country) as "DE" | "AT" | "CH",
    defaultRateEuros: ((org.defaultHourlyRateCents ?? 0) / 100).toFixed(2),
  };

  const labels = {
    title: t("title"),
    subtitle: t("subtitle"),
    sectionBusiness: t("section_business"),
    sectionContact: t("section_contact"),
    sectionAddress: t("section_address"),
    sectionDefaults: t("section_defaults"),
    name: t("name"),
    vatId: t("vat_id"),
    phone: t("phone"),
    website: t("website"),
    street: t("street"),
    postal: t("postal"),
    city: t("city"),
    country: t("country"),
    countryDe: t("country_de"),
    countryAt: t("country_at"),
    countryCh: t("country_ch"),
    defaultRate: t("default_rate"),
    save: t("save"),
  };

  return (
    <GeneralForm
      orgSlug={orgSlug}
      initial={initial}
      labels={labels}
      onSave={saveGeneralSettings}
    />
  );
}
