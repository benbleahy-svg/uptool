"use client";

import { useState } from "react";

interface Option {
  value: string;
  label: string;
}

export interface TemplateRow {
  id: string;
  name: string;
  operationType: string;
  costCategory: string;
  setupMinutes: string;
  runMinutes: string;
  hourlyRateCents: number;
  usageCount: number;
}

interface Labels {
  name: string;
  type: string;
  costCategory: string;
  setup: string;
  run: string;
  rate: string;
  usage: string;
  edit: string;
  save: string;
  cancel: string;
  delete: string;
  deleteConfirm: string;
  empty: string;
}

interface Props {
  orgSlug: string;
  templates: TemplateRow[];
  typeOptions: Option[];
  categoryOptions: Option[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  labels: Labels;
}

const centsToEuros = (cents: number): string => (cents / 100).toFixed(2);
const labelFor = (options: Option[], value: string): string =>
  options.find((o) => o.value === value)?.label ?? value;

const cellInput =
  "w-full rounded border border-[hsl(var(--border))] px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]";
const th =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]";

export function TemplatesTable({
  orgSlug,
  templates,
  typeOptions,
  categoryOptions,
  updateAction,
  deleteAction,
  labels,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (templates.length === 0) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">{labels.empty}</p>;
  }

  return (
    <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
          <tr>
            <th className={th}>{labels.name}</th>
            <th className={th}>{labels.type}</th>
            <th className={th}>{labels.costCategory}</th>
            <th className={`${th} text-right`}>{labels.setup}</th>
            <th className={`${th} text-right`}>{labels.run}</th>
            <th className={`${th} text-right`}>{labels.rate}</th>
            <th className={`${th} text-right`}>{labels.usage}</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--border))]">
          {templates.map((tmpl) =>
            editingId === tmpl.id ? (
              <tr key={tmpl.id} className="bg-[hsl(var(--muted)/0.2)]">
                <td colSpan={8} className="px-3 py-2">
                  <form
                    action={async (fd) => {
                      await updateAction(fd);
                      setEditingId(null);
                    }}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="templateId" value={tmpl.id} />
                    <input
                      name="name"
                      defaultValue={tmpl.name}
                      required
                      aria-label={labels.name}
                      className={`${cellInput} col-span-3`}
                    />
                    <select
                      name="operationType"
                      defaultValue={tmpl.operationType}
                      aria-label={labels.type}
                      className={`${cellInput} col-span-2`}
                    >
                      {typeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      name="costCategory"
                      defaultValue={tmpl.costCategory}
                      aria-label={labels.costCategory}
                      className={`${cellInput} col-span-2`}
                    >
                      {categoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="setupMinutes"
                      type="number"
                      min="0"
                      step="0.5"
                      defaultValue={tmpl.setupMinutes}
                      aria-label={labels.setup}
                      className={`${cellInput} col-span-1`}
                    />
                    <input
                      name="runMinutes"
                      type="number"
                      min="0"
                      step="0.5"
                      defaultValue={tmpl.runMinutes}
                      aria-label={labels.run}
                      className={`${cellInput} col-span-1`}
                    />
                    <input
                      name="rateEuros"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={centsToEuros(tmpl.hourlyRateCents)}
                      aria-label={labels.rate}
                      className={`${cellInput} col-span-1`}
                    />
                    <div className="col-span-2 flex justify-end gap-2">
                      <button
                        type="submit"
                        className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1 text-xs font-medium hover:opacity-90"
                      >
                        {labels.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-[hsl(var(--border))] px-3 py-1 text-xs hover:bg-white"
                      >
                        {labels.cancel}
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={tmpl.id} className="hover:bg-[hsl(var(--muted)/0.2)]">
                <td className="px-3 py-2 font-medium">{tmpl.name}</td>
                <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                  {labelFor(typeOptions, tmpl.operationType)}
                </td>
                <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                  {labelFor(categoryOptions, tmpl.costCategory)}
                </td>
                <td className="px-3 py-2 text-right">{tmpl.setupMinutes}</td>
                <td className="px-3 py-2 text-right">{tmpl.runMinutes}</td>
                <td className="px-3 py-2 text-right">€{centsToEuros(tmpl.hourlyRateCents)}/h</td>
                <td className="px-3 py-2 text-right text-[hsl(var(--muted-foreground))]">
                  {tmpl.usageCount}×
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setEditingId(tmpl.id)}
                    className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    {labels.edit}
                  </button>
                  <form
                    action={deleteAction}
                    className="inline"
                    onSubmit={(e) => {
                      if (!confirm(labels.deleteConfirm)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="templateId" value={tmpl.id} />
                    <button
                      type="submit"
                      className="ml-3 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600"
                    >
                      {labels.delete}
                    </button>
                  </form>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
