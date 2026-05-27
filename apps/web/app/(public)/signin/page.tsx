import { getTranslations } from "next-intl/server";
import { SignInForm } from "./signin-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.signin");
  return { title: t("title") };
}

export default async function SignInPage() {
  const t = await getTranslations("auth.signin");

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-lg border border-[hsl(var(--border))] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold mb-6">{t("title")}</h1>
        <SignInForm />
      </div>
    </div>
  );
}
