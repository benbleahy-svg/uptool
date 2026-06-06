import { db } from "@uptool/db";
import { MATERIAL_CATEGORIES, orgMaterialService } from "@uptool/services";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { MaterialsManager } from "./materials-table";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const STALE_DAYS = 7;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

export default async function MaterialsPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const materials = await orgMaterialService.findAll(org.id);
  const t = await getTranslations("settings.materials");

  const now = Date.now();
  const categoryOptions = MATERIAL_CATEGORIES.map((value) => ({
    value,
    label: t(`cat_${value}`),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>

      <MaterialsManager
        orgSlug={orgSlug}
        categoryOptions={categoryOptions}
        materials={materials.map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          densityGCm3: m.densityGCm3,
          priceEurPerKg: m.priceEurPerKg,
          priceUpdatedAt: m.priceUpdatedAt.toISOString(),
          isStale: now - m.priceUpdatedAt.getTime() > STALE_MS,
          isDefault: m.isDefault,
        }))}
        labels={{
          add: t("add"),
          edit: t("edit"),
          save: t("save"),
          cancel: t("cancel"),
          delete: t("delete"),
          deleteConfirm: t("delete_confirm"),
          name: t("name"),
          category: t("category"),
          density: t("density"),
          price: t("price"),
          updated: t("updated"),
          markUpdated: t("mark_updated"),
          stale: t("stale"),
          defaultLocked: t("default_locked"),
          empty: t("empty"),
        }}
      />
    </div>
  );
}
