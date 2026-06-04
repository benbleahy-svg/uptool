import { getTranslations } from "next-intl/server";

// Shown while the Server Component hydrates + loads persisted estimate state.
export default async function Loading() {
  const t = await getTranslations("estimate");
  return (
    <div className="grid h-full place-items-center text-sm text-[hsl(var(--muted-foreground))]">
      {t("loading")}
    </div>
  );
}
