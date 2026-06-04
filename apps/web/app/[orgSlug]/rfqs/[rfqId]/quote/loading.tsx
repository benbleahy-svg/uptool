import { getTranslations } from "next-intl/server";

// Shown while the Server Component loads persisted tier rows + notes.
export default async function Loading() {
  const t = await getTranslations("quote");
  return (
    <div className="grid h-full place-items-center text-sm text-[hsl(var(--muted-foreground))]">
      {t("loading")}
    </div>
  );
}
