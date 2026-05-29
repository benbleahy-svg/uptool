"use client";

import { segmentsFromValues } from "@/lib/quoting/estimateTotals";
import { formatAmount } from "@/lib/quoting/materialCost";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@uptool/ui";
import { Info, Trash2 } from "lucide-react";
import * as React from "react";
import { BreakdownBar } from "../_components/breakdown-bar";
import { CadThumb } from "../_components/cad-thumb";
import { DEFAULT_QUOTE_NOTE, QUOTE_CUSTOMER, QUOTE_PARTS } from "./quote-data";
import {
  type QuoteGroup,
  type QuoteLine,
  buildInitialLines,
  quoteTotalPrice,
  quoteUnitPrice,
} from "./quote-state";

const money = (n: number) => `${formatAmount(n)} €`;

export function QuoteView() {
  const [lines, setLines] = React.useState<QuoteLine[]>(buildInitialLines);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [notes, setNotes] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(QUOTE_PARTS.map((p) => [p.partId, p.defaultNote])),
  );
  const [editingNote, setEditingNote] = React.useState<string | null>(null);
  const [quoteNote, setQuoteNote] = React.useState(DEFAULT_QUOTE_NOTE);
  const [showNoBid, setShowNoBid] = React.useState(false);
  const [showMarkup, setShowMarkup] = React.useState(false);
  const [roundUnit, setRoundUnit] = React.useState(false);
  const [groups, setGroups] = React.useState<QuoteGroup[]>([]);
  const [groupName, setGroupName] = React.useState("Group 1");
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleParts = QUOTE_PARTS.filter((p) => showNoBid || !p.noBid);
  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.id));

  // Selected-totals summary (only the chosen subset is ever meaningful).
  const selectedLines = lines.filter((l) => selected.has(l.id));
  const selEstimateTotal = selectedLines.reduce((s, l) => s + l.estimateUnitPrice * l.quantity, 0);
  const selQuoteTotal = selectedLines.reduce(
    (s, l) => s + quoteUnitPrice(l.estimateUnitPrice, l.markup, roundUnit) * l.quantity,
    0,
  );
  const selBreakdown = selectedLines.reduce(
    (acc, l) => ({
      materials: acc.materials + l.breakdown.materials,
      nr: acc.nr + l.breakdown.nr,
      recurring: acc.recurring + l.breakdown.recurring,
      outside: acc.outside + l.breakdown.outside,
    }),
    { materials: 0, nr: 0, recurring: 0, outside: 0 },
  );

  function updateLine(id: string, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function deleteLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(lines.map((l) => l.id)));
  }
  function resetAll() {
    setLines(buildInitialLines());
    setSelected(new Set());
    setGroups([]);
  }
  function addGroup() {
    if (selected.size === 0) return;
    setGroups((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: groupName.trim() || `Group ${prev.length + 1}`,
        lineIds: [...selected],
      },
    ]);
  }
  function groupSubtotal(group: QuoteGroup): number {
    return lines
      .filter((l) => group.lineIds.includes(l.id))
      .reduce(
        (sum, l) => sum + quoteTotalPrice(l.estimateUnitPrice, l.markup, l.quantity, roundUnit),
        0,
      );
  }
  function preview() {
    setToast("Preview coming soon");
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col bg-white">
        <div className="flex flex-1 overflow-auto">
          {/* Main column */}
          <div className="min-w-0 flex-1 p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Quote</h1>
              <div className="flex items-center gap-5">
                <ToggleSwitch
                  label="Show No Bid Parts"
                  checked={showNoBid}
                  onChange={setShowNoBid}
                />
                <ToggleSwitch
                  label="Show Estimate & Markup"
                  checked={showMarkup}
                  onChange={setShowMarkup}
                />
                <ToggleSwitch
                  label="Round Quote Unit Price"
                  checked={roundUnit}
                  onChange={setRoundUnit}
                />
                <button
                  type="button"
                  onClick={resetAll}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Reset All
                </button>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left align-bottom text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">Items</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
                    Select All:{" "}
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all lines"
                      className="ml-1 align-middle accent-[hsl(var(--primary))]"
                    />
                  </th>
                  <th className="px-2 py-2 text-right font-medium">Quantity</th>
                  {showMarkup && (
                    <th className="px-2 py-2 text-right font-medium">Estimate Unit Price</th>
                  )}
                  {showMarkup && <th className="px-2 py-2 text-right font-medium">Markup</th>}
                  <th className="px-2 py-2 text-right font-medium">Quote Unit Price</th>
                  <th className="px-2 py-2 text-right font-medium">Quote Total Price</th>
                  <th className="px-2 py-2 text-left font-medium">Lead Time</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleParts.map((part) => {
                  const partLines = lines.filter((l) => l.partId === part.partId);
                  const rowCount = part.noBid ? 1 : Math.max(partLines.length, 1);
                  const items = (
                    <td
                      rowSpan={rowCount}
                      className={cn(
                        "w-[300px] border-b border-gray-200 px-4 py-4 align-top",
                        part.noBid && "opacity-50",
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-gray-200">
                          <CadThumb className="h-full w-full" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900">
                            {part.partNumber}
                            {part.revision && (
                              <span className="ml-1 font-normal text-gray-400">
                                Rev {part.revision}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-gray-400">{part.description}</div>
                          {!part.noBid && (
                            <NoteCell
                              value={notes[part.partId] ?? ""}
                              editing={editingNote === part.partId}
                              onOpen={() => setEditingNote(part.partId)}
                              onChange={(v) => setNotes((p) => ({ ...p, [part.partId]: v }))}
                              onClose={() => setEditingNote(null)}
                            />
                          )}
                        </div>
                      </div>
                    </td>
                  );

                  if (part.noBid) {
                    return (
                      <tr key={part.partId} className="text-gray-400">
                        {items}
                        <td className="border-b border-gray-200 px-2 py-3 text-right">—</td>
                        <td className="border-b border-gray-200 px-2 py-3 text-right">—</td>
                        {showMarkup && (
                          <td className="border-b border-gray-200 px-2 py-3 text-right">—</td>
                        )}
                        {showMarkup && (
                          <td className="border-b border-gray-200 px-2 py-3 text-right">—</td>
                        )}
                        <td className="border-b border-gray-200 px-2 py-3 text-right text-[11px] uppercase tracking-wide">
                          No Bid
                        </td>
                        <td className="border-b border-gray-200 px-2 py-3 text-right">—</td>
                        <td className="border-b border-gray-200 px-2 py-3">—</td>
                        <td className="border-b border-gray-200 px-2 py-3" />
                      </tr>
                    );
                  }

                  return partLines.map((line, idx) => {
                    const unit = quoteUnitPrice(line.estimateUnitPrice, line.markup, roundUnit);
                    return (
                      <tr key={line.id} className="hover:bg-gray-50/60">
                        {idx === 0 && items}
                        <td className="border-b border-gray-200 px-2 py-3 text-right">
                          <input
                            type="checkbox"
                            checked={selected.has(line.id)}
                            onChange={() => toggleSelect(line.id)}
                            aria-label={`Select ${part.partNumber} qty ${line.quantity}`}
                            className="accent-[hsl(var(--primary))]"
                          />
                        </td>
                        <td className="border-b border-gray-200 px-2 py-3 text-right tabular-nums text-gray-700">
                          {line.quantity}
                        </td>
                        {showMarkup && (
                          <td className="border-b border-gray-200 px-2 py-3 text-right tabular-nums text-sky-600">
                            {money(line.estimateUnitPrice)}
                          </td>
                        )}
                        {showMarkup && (
                          <td className="border-b border-gray-200 px-2 py-3 text-right">
                            <span className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={line.markup}
                                onChange={(e) => updateLine(line.id, { markup: e.target.value })}
                                aria-label="Markup percent"
                                className="w-10 bg-transparent text-right tabular-nums outline-none"
                              />
                              <span className="text-gray-400">%</span>
                            </span>
                          </td>
                        )}
                        <td className="border-b border-gray-200 px-2 py-3 text-right font-medium tabular-nums text-gray-900">
                          {money(unit)}
                        </td>
                        <td className="border-b border-gray-200 px-2 py-3 text-right font-medium tabular-nums text-gray-900">
                          {money(unit * line.quantity)}
                        </td>
                        <td className="border-b border-gray-200 px-2 py-3">
                          <input
                            type="text"
                            value={line.leadTime}
                            onChange={(e) => updateLine(line.id, { leadTime: e.target.value })}
                            aria-label="Lead time"
                            className="w-28 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                          />
                        </td>
                        <td className="border-b border-gray-200 px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteLine(line.id)}
                            aria-label="Delete line"
                            className="text-gray-300 transition-colors hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>

            {/* Selected-totals summary — only when ≥1 row is selected */}
            {selectedLines.length > 0 && (
              <div className="mt-6 flex justify-end">
                <div className="w-[26rem]">
                  <div className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    Selected ({selectedLines.length} line item
                    {selectedLines.length === 1 ? "" : "s"})
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className="text-sm text-gray-500">Estimate total</span>
                    <HoverCard openDelay={150} closeDelay={0}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          aria-label="Cost breakdown"
                          className="text-gray-400 transition-colors hover:text-gray-600"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent align="end" side="bottom" className="w-auto p-4">
                        <BreakdownBar
                          segments={segmentsFromValues(selBreakdown)}
                          className="w-[44rem] max-w-[85vw]"
                        />
                      </HoverCardContent>
                    </HoverCard>
                    <span className="w-28 text-right text-base font-bold tabular-nums text-gray-900">
                      {money(selEstimateTotal)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="text-sm text-gray-500">Quote total</span>
                    <span className="w-28 text-right text-base font-bold tabular-nums text-gray-900">
                      {money(selQuoteTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Group Total control */}
            <div className="mt-4 flex items-center gap-2">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                aria-label="Group name"
                className="w-32 rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
              <button
                type="button"
                onClick={addGroup}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Add Group Total
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About group totals"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  Bundles the selected line items into a single combined subtotal line on the quote.
                </TooltipContent>
              </Tooltip>
            </div>

            {groups.length > 0 && (
              <div className="mt-3 space-y-1">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-gray-900">
                        {money(groupSubtotal(g))}
                      </span>
                      <button
                        type="button"
                        onClick={() => setGroups((prev) => prev.filter((x) => x.id !== g.id))}
                        aria-label="Remove group"
                        className="text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <aside className="w-[340px] shrink-0 border-l border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Customer Information</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Field label="Contact" value={QUOTE_CUSTOMER.contact} />
              <Field label="Organization" value={QUOTE_CUSTOMER.organization} />
              <Field label="QuickBooks Online Customer" value={QUOTE_CUSTOMER.quickbooksCustomer} />
            </dl>

            <h2 className="mt-6 text-sm font-semibold text-gray-900">Add Notes to Quote</h2>
            <textarea
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
              rows={6}
              aria-label="Notes to quote"
              className="mt-2 w-full resize-y rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </aside>
        </div>

        {/* Sticky CTA */}
        <div className="flex flex-none items-center justify-end border-t border-gray-200 bg-white px-6 py-3">
          <button
            type="button"
            onClick={preview}
            className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
          >
            Preview Quote and Update QB
          </button>
        </div>

        {toast && (
          <div className="fixed bottom-16 right-6 z-50 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-[hsl(var(--primary))]" : "bg-gray-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function NoteCell({
  value,
  editing,
  onOpen,
  onChange,
  onClose,
}: {
  value: string;
  editing: boolean;
  onOpen: () => void;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  if (editing) {
    return (
      <textarea
        // biome-ignore lint/a11y/noAutofocus: opened by an explicit click
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onClose}
        rows={2}
        aria-label="Part note"
        className="mt-1 w-full resize-y rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
      />
    );
  }
  if (value) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-1 block text-left text-xs italic text-gray-500 hover:underline"
      >
        {value}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-1 block text-xs text-[hsl(var(--primary))] hover:underline"
    >
      Add a note…
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-400">{label}:</dt>
      <dd className="text-right text-gray-700">{value}</dd>
    </div>
  );
}
