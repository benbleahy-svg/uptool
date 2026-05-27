import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { NewOrgForm } from "./new-org-form";

export default async function NewOrgPage() {
  const { defaultOrgSlug } = await requireAuth();

  if (defaultOrgSlug) {
    redirect(`/${defaultOrgSlug}/rfqs`);
  }

  const t = await getTranslations("onboarding.new_org");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--muted))]">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-[hsl(var(--border))] bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold mb-6">{t("title")}</h1>
          <NewOrgForm />
        </div>
      </div>
    </div>
  );
}
