import { db } from "@uptool/db";
import { templateService } from "@uptool/services";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { addTemplate, deleteTemplate, seedDachTemplates, updateTemplate } from "./actions";
import { TemplatesTable } from "./templates-table";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const OP_TYPE_KEYS = [
  ["machining", "type_machining"],
  ["inspection", "type_inspection"],
  ["pack-and-ship", "type_pack_and_ship"],
  ["finishing", "type_finishing"],
  ["expense", "type_expense"],
  ["other", "type_other"],
] as const;

const COST_CATEGORY_KEYS = [
  ["inside", "cat_inside"],
  ["outside", "cat_outside"],
  ["purchased", "cat_purchased"],
] as const;

export default async function CalculatorTemplatesPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const templates = await templateService.findAll(org.id);
  const t = await getTranslations("settings.kalkulation");

  const typeOptions = OP_TYPE_KEYS.map(([value, key]) => ({ value, label: t(key) }));
  const categoryOptions = COST_CATEGORY_KEYS.map(([value, key]) => ({ value, label: t(key) }));

  const inputClass =
    "w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
        </div>
        <form action={seedDachTemplates}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <button
            type="submit"
            className="shrink-0 rounded border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium hover:bg-[hsl(var(--muted)/0.4)]"
          >
            {t("seed")}
          </button>
        </form>
      </div>

      {/* Add template */}
      <form
        action={addTemplate}
        className="grid grid-cols-12 gap-2 items-end rounded-md border border-[hsl(var(--border))] p-4"
      >
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <div className="col-span-3">
          <label htmlFor="tmpl-name" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("name")}
          </label>
          <input id="tmpl-name" name="name" required placeholder="CNC Milling" className={inputClass} />
        </div>
        <div className="col-span-2">
          <label htmlFor="tmpl-type" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("type")}
          </label>
          <select id="tmpl-type" name="operationType" className={inputClass} defaultValue="machining">
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="tmpl-cat" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("cost_category")}
          </label>
          <select id="tmpl-cat" name="costCategory" className={inputClass} defaultValue="inside">
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tmpl-setup" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("setup")}
          </label>
          <input id="tmpl-setup" name="setupMinutes" type="number" min="0" step="0.5" defaultValue="0" className={inputClass} />
        </div>
        <div>
          <label htmlFor="tmpl-run" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("run")}
          </label>
          <input id="tmpl-run" name="runMinutes" type="number" min="0" step="0.5" defaultValue="0" className={inputClass} />
        </div>
        <div>
          <label htmlFor="tmpl-rate" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("rate")}
          </label>
          <input id="tmpl-rate" name="rateEuros" type="number" min="0" step="0.01" defaultValue="80" className={inputClass} />
        </div>
        <button
          type="submit"
          className="col-span-1 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          {t("add")}
        </button>
      </form>

      <TemplatesTable
        orgSlug={orgSlug}
        templates={templates.map((tmpl) => ({
          id: tmpl.id,
          name: tmpl.name,
          operationType: tmpl.operationType,
          costCategory: tmpl.costCategory,
          setupMinutes: tmpl.defaultSetupMinutes,
          runMinutes: tmpl.defaultRunMinutes,
          hourlyRateCents: tmpl.defaultHourlyRateCents,
          usageCount: tmpl.usageCount,
        }))}
        typeOptions={typeOptions}
        categoryOptions={categoryOptions}
        updateAction={updateTemplate}
        deleteAction={deleteTemplate}
        labels={{
          name: t("name"),
          type: t("type"),
          costCategory: t("cost_category"),
          setup: t("setup"),
          run: t("run"),
          rate: t("rate"),
          usage: t("usage"),
          edit: t("edit"),
          save: t("save"),
          cancel: t("cancel"),
          delete: t("delete"),
          deleteConfirm: t("delete_confirm"),
          empty: t("empty"),
        }}
      />
    </div>
  );
}
