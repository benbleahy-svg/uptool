import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { templateService } from "@uptool/services";
import { addTemplate, deleteTemplate } from "./actions";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function OperationTemplatesPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireAuth();

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();

  const templates = await templateService.findAll(org.id);
  const t = await getTranslations("settings.operation_templates");
  const tEst = await getTranslations("estimate");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("subtitle")}</p>
      </div>

      {/* Add template form */}
      <form action={addTemplate} className="grid grid-cols-6 gap-2 items-end rounded-md border border-[hsl(var(--border))] p-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <div>
          <label htmlFor="tmpl-type" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("type")}
          </label>
          <select
            id="tmpl-type"
            name="operationType"
            className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            <option value="machining">{tEst("operation_type_machining")}</option>
            <option value="expense">{tEst("operation_type_expense")}</option>
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="tmpl-name" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("name")}
          </label>
          <input
            id="tmpl-name"
            name="name"
            required
            placeholder="CNC Milling"
            className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div>
          <label htmlFor="tmpl-setup" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("setup")}
          </label>
          <input
            id="tmpl-setup"
            name="setupMinutes"
            type="number"
            min="0"
            step="0.5"
            defaultValue="0"
            className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div>
          <label htmlFor="tmpl-run" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("run")}
          </label>
          <input
            id="tmpl-run"
            name="runMinutes"
            type="number"
            min="0"
            step="0.5"
            defaultValue="0"
            className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div>
          <label htmlFor="tmpl-rate" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("rate")}
          </label>
          <input
            id="tmpl-rate"
            name="rateEuros"
            type="number"
            min="0"
            step="0.01"
            defaultValue="120"
            className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-1.5 text-sm font-medium hover:opacity-90"
        >
          {t("add")}
        </button>
      </form>

      {/* Templates list */}
      {templates.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("empty")}</p>
      ) : (
        <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("name")}
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("type")}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("setup")}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("run")}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("rate")}
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {t("usage")}
                </th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {templates.map((tmpl) => (
                <tr key={tmpl.id} className="hover:bg-[hsl(var(--muted)/0.2)]">
                  <td className="px-4 py-2 font-medium">
                    <span className="mr-1.5 text-[hsl(var(--muted-foreground))]">
                      {tmpl.operationType === "expense" ? "$" : "⏱"}
                    </span>
                    {tmpl.name}
                  </td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">
                    {tmpl.operationType === "expense"
                      ? tEst("operation_type_expense")
                      : tEst("operation_type_machining")}
                  </td>
                  <td className="px-4 py-2 text-right">{tmpl.defaultSetupMinutes}</td>
                  <td className="px-4 py-2 text-right">{tmpl.defaultRunMinutes}</td>
                  <td className="px-4 py-2 text-right">€{centsToEuros(tmpl.defaultHourlyRateCents)}/h</td>
                  <td className="px-4 py-2 text-right text-[hsl(var(--muted-foreground))]">
                    {tmpl.usageCount}×
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteTemplate}>
                      <input type="hidden" name="orgSlug" value={orgSlug} />
                      <input type="hidden" name="templateId" value={tmpl.id} />
                      <button
                        type="submit"
                        className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600"
                      >
                        {t("delete")}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
