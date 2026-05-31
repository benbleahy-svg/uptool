"use client";

import { segmentsFromValues } from "@/lib/quoting/estimateTotals";
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
import { saveQuoteSnapshot } from "@/lib/quoting/quote-store";
import { Info, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { BreakdownBar } from "../_components/breakdown-bar";
import { CadThumb } from "../_components/cad-thumb";
import { DEFAULT_QUOTE_NOTE, QUOTE_CUSTOMER, QUOTE_PARTS } from "./quote-data";
import {
  type QuoteGroup,
  type QuoteLine,
  buildInitialLines,
  buildSnapshot,
  quoteTotalPrice,
  quoteUnitPrice,
} from "./quote-state";

interface BulkOption {
  id: string;
  leadTime: string;
  markup: string;
}

// German currency formatting with a fixed 2 decimal places (e.g. 1.234,70 €).
const money = (n: number) =>
  `${n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;

export function QuoteView({
  customer = QUOTE_CUSTOMER,
  orgSlug,
  rfqParam,
  rfqId,
  rfqNumber,
}: {
  customer?: typeof QUOTE_CUSTOMER;
  orgSlug?: string;
  rfqParam?: string;
  rfqId?: string;
  rfqNumber?: number;
}) {
  const router = useRouter();
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
  // Bulk-action panel (right sidebar): one or more {leadTime, markup} options.
  // Applying duplicates each selected line into one row per option (see 17.4).
  const [bulkOptions, setBulkOptions] = React.useState<BulkOption[]>(() => [
    { id: "opt-base", leadTime: "", markup: "" },
  ]);
  const [bulkDismissed, setBulkDismissed] = React.useState(false);
  const optionSeq = React.useRef(0);
  const [groups, setGroups] = React.useState<QuoteGroup[]>([]);
  const [groupName, setGroupName] = React.useState("Group 1");
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleParts = QUOTE_PARTS.filter((p) => showNoBid || !p.noBid);
  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.id));

  // Selected-totals summary (only the chosen subset is ever meaningful).
  const selectedLines = lines.filter((l) => selected.has(l.id));
  // The bulk panel replaces Customer Info at the top of the sidebar while a
  // selection exists and markup is shown, until the user applies/cancels it.
  const bulkOpen = showMarkup && selectedLines.length > 0 && !bulkDismissed;
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
    setBulkDismissed(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setBulkDismissed(false);
    setSelected(allSelected ? new Set() : new Set(lines.map((l) => l.id)));
  }
  function addOption() {
    setBulkOptions((prev) => [
      ...prev,
      { id: `opt-${optionSeq.current++}`, leadTime: "", markup: "" },
    ]);
  }
  function removeOption(id: string) {
    setBulkOptions((prev) => (prev.length > 1 ? prev.filter((o) => o.id !== id) : prev));
  }
  function updateOption(id: string, patch: Partial<BulkOption>) {
    setBulkOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function resetBulkOptions() {
    optionSeq.current = 0;
    setBulkOptions([{ id: "opt-base", leadTime: "", markup: "" }]);
  }
  // Replace each selected line with one duplicate per option, each carrying that
  // option's markup + lead time. A single option edits the line in place (it
  // keeps the original id); extra options become new rows beside it (see 17.4).
  function applyBulk() {
    setLines((prev) =>
      prev.flatMap((line) => {
        if (!selected.has(line.id)) return [line];
        return bulkOptions.map((opt, i) => ({
          ...line,
          id: i === 0 ? line.id : `${line.id}::${crypto.randomUUID()}`,
          markup: opt.markup,
          leadTime: opt.leadTime,
        }));
      }),
    );
    resetBulkOptions();
    setBulkDismissed(true);
  }
  function cancelBulk() {
    resetBulkOptions();
    setBulkDismissed(true);
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
  // "Preview Quote": persist the quote (number + current lines/variants/notes)
  // to the client store, then navigate to the Send page. Quote number is stubbed
  // to the RFQ number for now (no DB persistence yet — see quote-store.ts).
  function preview() {
    if (!orgSlug || !rfqParam || !rfqId) {
      setToast("Preview unavailable");
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2500);
      return;
    }
    const snapshot = buildSnapshot(lines, notes, quoteNote, rfqNumber ?? 0, roundUnit);
    saveQuoteSnapshot(rfqId, snapshot);
    router.push(`/${orgSlug}/rfqs/${rfqParam}/send`);
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
                  onChange={(v) => {
                    setShowMarkup(v);
                    if (v) setBulkDismissed(false);
                  }}
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
                    <HoverCard openDelay={150} closeDelay={250}>
                      <HoverCardTrigger asChild>
                        <button
                          type="button"
                          aria-label="Cost breakdown"
                          className="text-gray-400 transition-colors hover:text-gray-600"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent
                        align="end"
                        side="bottom"
                        sideOffset={2}
                        className="w-auto p-4"
                      >
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
            {bulkOpen && (
              <div className="-mx-5 -mt-5 mb-5 border-b border-gray-200 bg-slate-50 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Update {selectedLines.length} Selected
                </h2>
                <div className="mt-3 flex items-center gap-3 text-xs font-medium text-gray-600">
                  <span className="flex-1">Lead Time</span>
                  <span className="w-20 text-right">Markup</span>
                  <span className="w-4 shrink-0" />
                </div>
                <div className="mt-1.5 space-y-2">
                  {bulkOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-3">
                      <input
                        type="text"
                        value={opt.leadTime}
                        onChange={(e) => updateOption(opt.id, { leadTime: e.target.value })}
                        placeholder="e.g. 3 weeks"
                        aria-label="Lead time"
                        className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      />
                      <span className="flex w-20 shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={opt.markup}
                          onChange={(e) => updateOption(opt.id, { markup: e.target.value })}
                          placeholder="0"
                          aria-label="Markup percent"
                          className="w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
                        />
                        <span className="text-gray-400">%</span>
                      </span>
                      {i > 0 ? (
                        <button
                          type="button"
                          onClick={() => removeOption(opt.id)}
                          aria-label="Remove option"
                          className="w-4 shrink-0 text-gray-300 transition-colors hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Add Option
                </button>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelBulk}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyBulk}
                    className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            <h2 className="text-sm font-semibold text-gray-900">Customer Information</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Field label="Contact" value={customer.contact} />
              <Field label="Organization" value={customer.organization} />
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
            Preview Quote
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
            "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
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
