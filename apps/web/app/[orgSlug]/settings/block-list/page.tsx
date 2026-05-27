import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { blockListService } from "@uptool/services";
import { addBlockEntry, removeBlockEntry } from "./actions";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function BlockListPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const entries = await blockListService.findByOrg(org.id);
  const t = await getTranslations("settings.block_list");

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>

      {/* Add form */}
      <form action={addBlockEntry} className="flex gap-2">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input
          id="block-value"
          name="value"
          required
          placeholder={t("placeholder")}
          className="flex-1 rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        />
        <button
          type="submit"
          className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          {t("add")}
        </button>
      </form>

      {/* Entries list */}
      {entries.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-md border border-[hsl(var(--border))]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm font-mono">{entry.value}</span>
              <form action={removeBlockEntry}>
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="entryId" value={entry.id} />
                <button
                  type="submit"
                  className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
