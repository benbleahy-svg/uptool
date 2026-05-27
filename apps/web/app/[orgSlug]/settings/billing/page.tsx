import { getTranslations } from "next-intl/server";
import { ComingSoon } from "../coming-soon";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function BillingPage({ params: _params }: Props) {
  const t = await getTranslations("settings");
  return (
    <ComingSoon
      pageTitle={t("nav_billing")}
      title={t("coming_soon_title")}
      subtitle={t("coming_soon_subtitle")}
    />
  );
}
