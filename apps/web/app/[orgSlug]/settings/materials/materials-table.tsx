"use client";

import { toast } from "@uptool/ui";
import { Check, Lock, Pencil, RotateCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addMaterial, deleteMaterial, markPriceUpdated, updateMaterial } from "./actions";

interface Option {
  value: string;
  label: string;
}

export interface MaterialRow {
  id: string;
  name: string;
  category: string;
  densityGCm3: string;
  priceEurPerKg: string;
  priceUpdatedAt: string;
  isStale: boolean;
  isDefault: boolean;
}

interface Labels {
  add: string;
  edit: string;
  save: string;
  cancel: string;
  delete: string;
  deleteConfirm: string;
  name: string;
  category: string;
  density: string;
  price: string;
  updated: string;
  markUpdated: string;
  stale: string;
  defaultLocked: string;
  empty: string;
}

interface Props {
  orgSlug: string;
  materials: MaterialRow[];
  categoryOptions: Option[];
  labels: Labels;
}

const num = (v: string): number => Number.parseFloat(v.replace(",", ".")) || 0;
const labelFor = (options: Option[], value: string): string =>
  options.find((o) => o.value === value)?.label ?? value;
const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString();
const fmtPrice = (v: string): string => num(v).toFixed(2);
const fmtDensity = (v: string): string => num(v).toString();

const cellInput =
  "w-full rounded border border-[hsl(var(--border))] px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]";
const th =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]";

export function MaterialsManager({ orgSlug, materials, categoryOptions, labels }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Error");
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    act(() =>
      addMaterial({
        orgSlug,
        // biome-ignore lint/suspicious/noExplicitAny: category validated server-side
        category: fd.get("category") as any,
        name: (fd.get("name") as string).trim(),
        densityGCm3: num(fd.get("densityGCm3") as string),
        priceEurPerKg: num(fd.get("priceEurPerKg") as string),
      }),
    );
    form.reset();
  }

  function onSaveEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    act(() =>
      updateMaterial({
        orgSlug,
        materialId: id,
        // biome-ignore lint/suspicious/noExplicitAny: category validated server-side
        category: fd.get("category") as any,
        name: (fd.get("name") as string).trim(),
        densityGCm3: num(fd.get("densityGCm3") as string),
        priceEurPerKg: num(fd.get("priceEurPerKg") as string),
      }),
    );
  }

  return (
    <div className="space-y-4">
      {/* Add material */}
      <form
        onSubmit={onAdd}
        className="grid grid-cols-12 gap-2 items-end rounded-md border border-[hsl(var(--border))] p-4"
      >
        <div className="col-span-4">
          <label htmlFor="mat-name" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {labels.name}
          </label>
          <input id="mat-name" name="name" required placeholder="S235JR" className={cellInput} />
        </div>
        <div className="col-span-3">
          <label htmlFor="mat-cat" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {labels.category}
          </label>
          <select id="mat-cat" name="category" className={cellInput} defaultValue="steel">
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="mat-density" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {labels.density}
          </label>
          <input id="mat-density" name="densityGCm3" type="number" min="0" step="0.0001" required className={cellInput} />
        </div>
        <div className="col-span-2">
          <label htmlFor="mat-price" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {labels.price}
          </label>
          <input id="mat-price" name="priceEurPerKg" type="number" min="0" step="0.0001" defaultValue="0" className={cellInput} />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="col-span-1 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {labels.add}
        </button>
      </form>

      {materials.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{labels.empty}</p>
      ) : (
        <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted)/0.4)] border-b border-[hsl(var(--border))]">
              <tr>
                <th className={th}>{labels.name}</th>
                <th className={th}>{labels.category}</th>
                <th className={`${th} text-right`}>{labels.density}</th>
                <th className={`${th} text-right`}>{labels.price}</th>
                <th className={th}>{labels.updated}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {materials.map((m) =>
                editingId === m.id ? (
                  <tr key={m.id} className="bg-[hsl(var(--muted)/0.2)]">
                    <td colSpan={6} className="px-3 py-2">
                      <form onSubmit={(e) => onSaveEdit(e, m.id)} className="grid grid-cols-12 gap-2 items-center">
                        <input name="name" defaultValue={m.name} required aria-label={labels.name} className={`${cellInput} col-span-4`} />
                        <select name="category" defaultValue={m.category} aria-label={labels.category} className={`${cellInput} col-span-3`}>
                          {categoryOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <input name="densityGCm3" type="number" min="0" step="0.0001" defaultValue={fmtDensity(m.densityGCm3)} aria-label={labels.density} className={`${cellInput} col-span-2`} />
                        <input name="priceEurPerKg" type="number" min="0" step="0.0001" defaultValue={fmtPrice(m.priceEurPerKg)} aria-label={labels.price} className={`${cellInput} col-span-2`} />
                        <div className="col-span-1 flex justify-end gap-1">
                          <button type="submit" disabled={isPending} aria-label={labels.save} className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] p-1.5 hover:opacity-90 disabled:opacity-50">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} aria-label={labels.cancel} className="rounded border border-[hsl(var(--border))] p-1.5 hover:bg-white">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-[hsl(var(--muted)/0.2)]">
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {m.isDefault && (
                          <Lock className="h-3 w-3 text-[hsl(var(--muted-foreground))]" aria-label={labels.defaultLocked} />
                        )}
                        {m.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">{labelFor(categoryOptions, m.category)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDensity(m.densityGCm3)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">€{fmtPrice(m.priceEurPerKg)}/kg</td>
                    <td className="px-3 py-2">
                      <span className="text-[hsl(var(--muted-foreground))]">{fmtDate(m.priceUpdatedAt)}</span>
                      {m.isStale && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {labels.stale}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => act(() => markPriceUpdated({ orgSlug, materialId: m.id }))}
                        disabled={isPending}
                        title={labels.markUpdated}
                        aria-label={labels.markUpdated}
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
                      >
                        <RotateCw className="inline h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(m.id)}
                        title={labels.edit}
                        aria-label={labels.edit}
                        className="ml-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                      >
                        <Pencil className="inline h-3.5 w-3.5" />
                      </button>
                      {m.isDefault ? (
                        <Lock
                          className="ml-3 inline h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]/40"
                          aria-label={labels.defaultLocked}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(labels.deleteConfirm))
                              act(() => deleteMaterial({ orgSlug, materialId: m.id }));
                          }}
                          disabled={isPending}
                          title={labels.delete}
                          aria-label={labels.delete}
                          className="ml-3 text-[hsl(var(--muted-foreground))] hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="inline h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
