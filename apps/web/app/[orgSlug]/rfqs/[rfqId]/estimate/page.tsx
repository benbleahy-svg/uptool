import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { partService, templateService } from "@uptool/services";
import { resolveRfq } from "@/lib/resolve-rfq";
import { addPart, addOperation, deletePart, deleteOperation, copyOperations } from "./actions";
import { updateRfqStatus } from "../../actions";
import { PartNotesForm } from "./part-notes-form";
import { OperationTemplateSelect, type TemplateOption } from "./operation-template-select";

const PROCESS_TYPE_OPTIONS = [
  "Sheet Metal",
  "CNC Milling",
  "CNC Turning",
  "3D Printing",
  "Fabrication",
  "Assembly",
  "Other",
] as const;

const PROCESS_BADGE_STYLES: Record<string, string> = {
  "Sheet Metal": "bg-blue-100 text-blue-800",
  "CNC Milling": "bg-green-100 text-green-800",
  "CNC Turning": "bg-teal-100 text-teal-800",
  "3D Printing": "bg-purple-100 text-purple-800",
  "Fabrication": "bg-orange-100 text-orange-800",
  "Assembly": "bg-yellow-100 text-yellow-800",
};

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

function centsToEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function EstimatePage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam } = await params;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const resolvedRfq = await resolveRfq(org.id, rfqParam);
  if (!resolvedRfq) notFound();
  const rfqId = resolvedRfq.id;

  const [parts, rawTemplates, otherParts] = await Promise.all([
    partService.findByRfq(org.id, rfqId),
    templateService.findAll(org.id),
    partService.findForOrg(org.id, rfqId),
  ]);

  // Mark recently used: any template with lastUsedAt set (top 5 by usage)
  const recentIds = new Set(
    rawTemplates
      .filter((t) => t.lastUsedAt !== null)
      .slice(0, 5)
      .map((t) => t.id),
  );
  const templateOptions: TemplateOption[] = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    operationType: t.operationType,
    defaultSetupMinutes: String(t.defaultSetupMinutes),
    defaultRunMinutes: String(t.defaultRunMinutes),
    defaultHourlyRateCents: t.defaultHourlyRateCents,
    isRecentlyUsed: recentIds.has(t.id),
  }));

  const rfq = resolvedRfq;

  const quantityBreaks = rfq.quantityBreaks?.length ? rfq.quantityBreaks : [1, 10, 100];

  const defaultRateEuros = ((org.defaultHourlyRateCents ?? 0) / 100).toFixed(2);
  const t = await getTranslations("estimate");
  const tRfq = await getTranslations("rfqs");

  // Flatten the parent/child hierarchy into a depth-annotated, DFS-ordered list
  // so each assembly renders immediately above its (indented) sub-parts.
  const orderedParts = buildPartTree(parts);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Part navigation (only shown when there are 2+ parts) */}
      {parts.length > 1 && (
        <nav className="flex flex-wrap gap-2">
          {parts.map((part) => (
            <a
              key={part.id}
              href={`#part-${part.id}`}
              className="text-xs rounded border border-[hsl(var(--border))] px-2 py-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            >
              {part.partNumber ?? `Part ${parts.indexOf(part) + 1}`}
              {part.revision ? ` Rev ${part.revision}` : ""}
            </a>
          ))}
        </nav>
      )}

      {parts.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("no_parts")}</p>
      ) : (
        orderedParts.map(({ part, depth }) => {
          const costs = partService.computeCostsForPart(
            part,
            part.operations,
            quantityBreaks,
          );

          return (
            <div
              id={`part-${part.id}`}
              key={part.id}
              style={depth > 0 ? { marginLeft: depth * 28 } : undefined}
              className={`rounded-md border border-[hsl(var(--border))] overflow-hidden${
                depth > 0 ? " border-l-2 border-l-[hsl(var(--primary)/0.4)]" : ""
              }`}
            >
              {/* Part header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
                <div className="flex items-start gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      {depth > 0 && (
                        <span className="text-[hsl(var(--muted-foreground))]" aria-hidden>
                          └
                        </span>
                      )}
                      <span>
                        {part.partNumber ?? "—"}
                        {part.revision ? ` Rev ${part.revision}` : ""}
                        {part.description ? ` — ${part.description}` : ""}
                      </span>
                      {part.assemblyQuantity > 1 && (
                        <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                          ×{part.assemblyQuantity}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[part.material, part.finish].filter(Boolean).join(" · ")}
                      {part.materialCostCents > 0
                        ? ` · Material: €${centsToEuros(part.materialCostCents)}/unit`
                        : ""}
                    </p>
                  </div>
                  {part.processType && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${PROCESS_BADGE_STYLES[part.processType] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {part.processType}
                    </span>
                  )}
                </div>
                <form action={deletePart} className="ml-4">
                  <input type="hidden" name="orgSlug" value={orgSlug} />
                  <input type="hidden" name="rfqId" value={rfqId} />
                  <input type="hidden" name="partId" value={part.id} />
                  <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                    {t("delete_part")}
                  </button>
                </form>
              </div>

              {/* Operations table */}
              <div className="px-4 py-3">
                {part.operations.length > 0 && (
                  <table className="w-full text-sm mb-3">
                    <thead>
                      <tr className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                        <th className="text-left pb-2 font-semibold">{t("operation_name")}</th>
                        <th className="text-right pb-2 font-semibold">{t("setup_min")}</th>
                        <th className="text-right pb-2 font-semibold">{t("run_min")}</th>
                        <th className="text-right pb-2 font-semibold">{t("hourly_rate")}</th>
                        {quantityBreaks.map((qty) => (
                          <th key={qty} className="text-right pb-2 font-semibold">
                            {t("cost_at_qty", { qty })}
                          </th>
                        ))}
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {part.operations.map((op) => {
                        const opCosts = partService.computeCostsForPart(
                          { materialCostCents: 0 },
                          [op],
                          quantityBreaks,
                        );
                        return (
                          <tr key={op.id}>
                            <td className="py-2">
                              <span className="mr-1.5 text-[hsl(var(--muted-foreground))]">
                                {op.operationType === "expense" ? "$" : "⏱"}
                              </span>
                              {op.name}
                              {op.isNonRecurring && (
                                <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">
                                  NR
                                </span>
                              )}
                            </td>
                            <td className="text-right py-2">{op.setupMinutes}</td>
                            <td className="text-right py-2">{op.runMinutes}</td>
                            <td className="text-right py-2">
                              €{centsToEuros(op.hourlyRateCents)}/h
                            </td>
                            {opCosts.map((c) => (
                              <td key={c.quantity} className="text-right py-2">
                                €{centsToEuros(c.costPerUnitCents)}
                              </td>
                            ))}
                            <td className="text-right py-2">
                              <form action={deleteOperation}>
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="rfqId" value={rfqId} />
                                <input type="hidden" name="operationId" value={op.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600"
                                >
                                  ✕
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                      <tr className="border-t border-[hsl(var(--border))] font-semibold">
                        <td className="pt-2 text-xs">{t("total_cost_per_unit")}</td>
                        <td />
                        <td />
                        <td />
                        {costs.map((c) => (
                          <td key={c.quantity} className="text-right pt-2 text-sm">
                            €{centsToEuros(c.costPerUnitCents)}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}

                {/* Per-part notes */}
                <PartNotesForm
                  orgSlug={orgSlug}
                  rfqId={rfqId}
                  partId={part.id}
                  notesExternal={part.notesExternal ?? null}
                  notesInternal={part.notesInternal ?? null}
                  labels={{
                    notesExternal: t("notes_external"),
                    notesExternalHint: t("notes_external_hint"),
                    notesInternal: t("notes_internal"),
                    notesInternalHint: t("notes_internal_hint"),
                  }}
                />

                {/* Add operation form */}
                <details className="group mt-3">
                  <summary className="text-xs font-medium text-[hsl(var(--primary))] cursor-pointer list-none hover:underline">
                    + {t("add_operation")}
                  </summary>
                  <form action={addOperation} className="mt-3 space-y-3">
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="rfqId" value={rfqId} />
                    <input type="hidden" name="partId" value={part.id} />
                    <OperationTemplateSelect
                      partId={part.id}
                      templates={templateOptions}
                      defaultRateEuros={defaultRateEuros}
                      labels={{
                        pickTemplate: t("pick_template"),
                        recentlyUsed: t("template_recently_used"),
                        all: t("template_all"),
                        manual: t("template_manual"),
                        noTemplates: t("no_templates"),
                        operationName: t("operation_name"),
                        operationType: t("operation_type"),
                        setupMin: t("setup_min"),
                        runMin: t("run_min"),
                        hourlyRate: t("hourly_rate"),
                        opTypeMachining: t("operation_type_machining"),
                        opTypeExpense: t("operation_type_expense"),
                        add: t("add"),
                      }}
                    />
                    <button
                      type="submit"
                      className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 text-sm font-medium hover:opacity-90"
                    >
                      {t("add")}
                    </button>
                  </form>
                </details>

                {/* Copy operations from another part */}
                {otherParts.length > 0 && (
                  <details className="group mt-2">
                    <summary className="text-xs font-medium text-[hsl(var(--muted-foreground))] cursor-pointer list-none hover:underline">
                      ↓ {t("copy_ops_from")}
                    </summary>
                    <form action={copyOperations} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="orgSlug" value={orgSlug} />
                      <input type="hidden" name="rfqId" value={rfqId} />
                      <input type="hidden" name="toPartId" value={part.id} />
                      <select
                        name="fromPartId"
                        className="flex-1 rounded border border-[hsl(var(--border))] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] bg-white"
                      >
                        {otherParts.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.rfq ? `RFQ #${op.rfq.rfqNumber}${op.rfq.subject ? ` — ${op.rfq.subject}` : ""}` : ""}{" "}
                            › {op.partNumber ?? "—"}
                            {op.revision ? ` Rev ${op.revision}` : ""}
                            {op.operations.length > 0 ? ` (${op.operations.length} ops)` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded border border-[hsl(var(--border))] px-2 py-1.5 text-xs hover:bg-[hsl(var(--accent))] transition-colors"
                      >
                        {t("copy")}
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Status actions */}
      {rfq.status !== "no_bid" && (
        <div className="flex items-center gap-3 pt-2 border-t border-[hsl(var(--border))]">
          <form action={updateRfqStatus}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="rfqId" value={rfqId} />
            <input type="hidden" name="status" value="no_bid" />
            <button
              type="submit"
              className="rounded border border-[hsl(var(--border))] bg-white text-[hsl(var(--muted-foreground))] px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              {tRfq("mark_no_bid")}
            </button>
          </form>
        </div>
      )}

      {/* Add part form */}
      <details className="group rounded-md border border-dashed border-[hsl(var(--border))] p-4">
        <summary className="text-sm font-medium text-[hsl(var(--primary))] cursor-pointer list-none hover:underline">
          + {t("add_part")}
        </summary>
        <form action={addPart} className="mt-4 grid grid-cols-3 gap-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="rfqId" value={rfqId} />
          <Field name="partNumber" label={t("part_number")} />
          <Field name="revision" label={t("revision")} />
          <Field name="description" label={t("description")} />
          <Field name="material" label={t("material")} />
          <Field name="finish" label={t("finish")} />
          <div>
            <label htmlFor="new-part-process-type" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {t("process_type")}
            </label>
            <select
              id="new-part-process-type"
              name="processType"
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] bg-white"
            >
              <option value="">—</option>
              {PROCESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-part-material-cost" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
              {t("material_cost")}
            </label>
            <input
              id="new-part-material-cost"
              name="materialCostEuros"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="col-span-3">
            <button
              type="submit"
              className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              {t("add_part")}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

function Field({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label htmlFor={`new-part-${name}`} className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">{label}</label>
      <input
        id={`new-part-${name}`}
        name={name}
        className="w-full rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      />
    </div>
  );
}

/**
 * Flatten a flat, already-sorted part list into DFS order annotated with depth,
 * using `parentPartId` for assembly → sub-assembly → part nesting. Roots (no
 * parent, or a parent outside this RFQ) come first in their existing order; each
 * node's children follow immediately, indented one level. Parts trapped in a
 * cycle are surfaced at the top level so nothing silently disappears.
 */
function buildPartTree<T extends { id: string; parentPartId: string | null }>(
  parts: T[],
): { part: T; depth: number }[] {
  const ids = new Set(parts.map((p) => p.id));
  const childrenByParent = new Map<string, T[]>();
  const roots: T[] = [];
  for (const p of parts) {
    if (p.parentPartId && ids.has(p.parentPartId)) {
      const arr = childrenByParent.get(p.parentPartId) ?? [];
      arr.push(p);
      childrenByParent.set(p.parentPartId, arr);
    } else {
      roots.push(p);
    }
  }

  const out: { part: T; depth: number }[] = [];
  const visited = new Set<string>();
  const visit = (node: T, depth: number) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    out.push({ part: node, depth });
    for (const child of childrenByParent.get(node.id) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  for (const p of parts) if (!visited.has(p.id)) out.push({ part: p, depth: 0 });
  return out;
}
