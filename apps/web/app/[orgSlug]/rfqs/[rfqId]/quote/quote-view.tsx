"use client";

import { saveQuoteSnapshot } from "@/lib/quoting/quote-store";
import { parseDecimal } from "@/lib/quoting/materialCost";
import { useRecordSync } from "@/lib/use-record-sync";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@uptool/ui";
import { ChevronDown, ChevronUp, Copy, Info, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CadThumb } from "../_components/cad-thumb";
import {
  addQuoteLineItemAction,
  deleteQuoteLineItemAction,
  duplicateQuoteLineItemAction,
  reorderQuoteLineItemsAction,
  updateQuoteLineItemAction,
  updateQuoteNotesAction,
  updateQuotePartNoteAction,
} from "./actions";
import {
  type QuoteGroup,
  type QuoteLine,
  type QuotePartMeta,
  buildSnapshot,
  computeQuoteUnitCents,
  displayUnitCents,
  isTempId,
  newTempId,
  rowToLine,
} from "./quote-state";

interface BulkOption {
  id: string;
  leadTime: string;
  markup: string;
}

interface Customer {
  contact: string;
  organization: string;
}

// German currency formatting from cents (e.g. 1.234,70 €).
const money = (cents: number) =>
  `${(cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;

const parseMarkupNum = (s: string) => (s.trim() === "" ? 0 : parseDecimal(s));
const parseWeeks = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Math.round(parseDecimal(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Re-price a line from its frozen cost + current markup (optimistic, mirrors server). */
function priced(line: QuoteLine): QuoteLine {
  const unit = computeQuoteUnitCents(line.costPerUnitCents, line.markup);
  return { ...line, quoteUnitPriceCents: unit, quoteTotalCents: unit * line.quantity };
}

export function QuoteView({
  customer,
  orgSlug,
  rfqParam,
  rfqId,
  rfqNumber,
  parts,
  initialLines,
  initialQuoteNote,
}: {
  customer?: Customer;
  orgSlug?: string;
  rfqParam?: string;
  rfqId?: string;
  rfqNumber?: number;
  parts: QuotePartMeta[];
  initialLines: QuoteLine[];
  initialQuoteNote: string;
}) {
  const router = useRouter();
  const t = useTranslations("quote");
  const { saving, schedule, runNow } = useRecordSync(t("save_failed"));

  // Persistence context — present in real use; absent only if the page couldn't
  // resolve the RFQ (then the builder is read-only).
  const ctx = orgSlug && rfqParam && rfqId ? { orgSlug, rfqParam, rfqId } : null;

  const [lines, setLines] = React.useState<QuoteLine[]>(initialLines);
  const [notes, setNotes] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(parts.map((p) => [p.partId, p.note])),
  );
  const [quoteNote, setQuoteNote] = React.useState(initialQuoteNote);
  const [editingNote, setEditingNote] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [showNoBid, setShowNoBid] = React.useState(false);
  const [showMarkup, setShowMarkup] = React.useState(false);
  const [roundUnit, setRoundUnit] = React.useState(false);
  const [bulkOptions, setBulkOptions] = React.useState<BulkOption[]>(() => [
    { id: "opt-base", leadTime: "", markup: "" },
  ]);
  const [bulkDismissed, setBulkDismissed] = React.useState(false);
  const optionSeq = React.useRef(0);
  const [groups, setGroups] = React.useState<QuoteGroup[]>([]);
  const [groupName, setGroupName] = React.useState("Group 1");

  const visibleParts = parts.filter((p) => showNoBid || !p.noBid);
  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.id));
  const selectedLines = lines.filter((l) => selected.has(l.id));
  const bulkOpen = showMarkup && selectedLines.length > 0 && !bulkDismissed;

  const dispUnit = (l: QuoteLine) => displayUnitCents(l.quoteUnitPriceCents, roundUnit);
  const dispTotal = (l: QuoteLine) => dispUnit(l) * l.quantity;

  const selEstimateTotal = selectedLines.reduce((s, l) => s + l.costPerUnitCents * l.quantity, 0);
  const selQuoteTotal = selectedLines.reduce((s, l) => s + dispTotal(l), 0);

  // ─── Field edits (debounced; optimistic, no success-reconcile to avoid
  //     clobbering newer keystrokes — server price matches the optimistic one) ──
  function editLine(
    lineId: string,
    patch: Partial<Pick<QuoteLine, "markup" | "quantity" | "leadTimeWeeks" | "tierLabel">>,
    field: string,
  ) {
    const before = lines.find((l) => l.id === lineId);
    if (!before) return;
    setLines((cur) =>
      cur.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...patch };
        return patch.markup !== undefined || patch.quantity !== undefined ? priced(next) : next;
      }),
    );
    if (!ctx || isTempId(lineId)) return; // temp row: its create carries the values
    const serverPatch: Record<string, unknown> = {};
    if (patch.markup !== undefined) serverPatch.markupPct = parseMarkupNum(patch.markup);
    if (patch.quantity !== undefined) serverPatch.quantity = patch.quantity;
    if (patch.leadTimeWeeks !== undefined) serverPatch.leadTimeWeeks = patch.leadTimeWeeks;
    if (patch.tierLabel !== undefined) serverPatch.tierLabel = patch.tierLabel;
    schedule(
      `${lineId}:${field}`,
      () =>
        updateQuoteLineItemAction({
          orgSlug: ctx.orgSlug,
          rfqParam: ctx.rfqParam,
          lineItemId: lineId,
          patch: serverPatch,
        }),
      () => setLines((cur) => cur.map((l) => (l.id === lineId ? before : l))),
    );
  }

  // ─── Structure changes (immediate; optimistic; reconcile temp→real on success) ─
  function addTier(part: QuotePartMeta, quantity: number, costPerUnitCents: number) {
    if (!ctx) return;
    const tmp = newTempId();
    const optimistic = priced({
      id: tmp,
      partId: part.partId,
      quantity,
      costPerUnitCents,
      markup: "",
      leadTimeWeeks: null,
      tierLabel: null,
      quoteUnitPriceCents: 0,
      quoteTotalCents: 0,
      sortOrder: lines.length,
    });
    setLines((cur) => [...cur, optimistic]);
    runNow(async () => {
      const res = await addQuoteLineItemAction({
        orgSlug: ctx.orgSlug,
        rfqParam: ctx.rfqParam,
        rfqId: ctx.rfqId,
        input: { partId: part.partId, quantity, costPerUnitCents, markupPct: 0 },
      });
      if (res.ok) setLines((cur) => cur.map((l) => (l.id === tmp ? rowToLine(res.data) : l)));
      return res;
    }, () => setLines((cur) => cur.filter((l) => l.id !== tmp)));
  }

  function generateFromEstimate() {
    if (!ctx) return;
    const seeds = parts
      .filter((p) => !p.noBid)
      .flatMap((p) => p.estimateByQty.map((e) => ({ part: p, e, tmp: newTempId() })));
    if (seeds.length === 0) return;
    setLines((cur) => [
      ...cur,
      ...seeds.map(({ part, e, tmp }, i) =>
        priced({
          id: tmp,
          partId: part.partId,
          quantity: e.quantity,
          costPerUnitCents: e.costPerUnitCents,
          markup: "",
          leadTimeWeeks: null,
          tierLabel: null,
          quoteUnitPriceCents: 0,
          quoteTotalCents: 0,
          sortOrder: cur.length + i,
        }),
      ),
    ]);
    for (const { part, e, tmp } of seeds) {
      runNow(async () => {
        const res = await addQuoteLineItemAction({
          orgSlug: ctx.orgSlug,
          rfqParam: ctx.rfqParam,
          rfqId: ctx.rfqId,
          input: { partId: part.partId, quantity: e.quantity, costPerUnitCents: e.costPerUnitCents, markupPct: 0 },
        });
        if (res.ok) setLines((cur) => cur.map((l) => (l.id === tmp ? rowToLine(res.data) : l)));
        return res;
      }, () => setLines((cur) => cur.filter((l) => l.id !== tmp)));
    }
  }

  function duplicateTier(lineId: string) {
    if (!ctx || isTempId(lineId)) return;
    const src = lines.find((l) => l.id === lineId);
    if (!src) return;
    const tmp = newTempId();
    const clone = priced({ ...src, id: tmp, markup: "", leadTimeWeeks: null, tierLabel: null });
    setLines((cur) => {
      const idx = cur.findIndex((l) => l.id === lineId);
      return [...cur.slice(0, idx + 1), clone, ...cur.slice(idx + 1)];
    });
    runNow(async () => {
      const res = await duplicateQuoteLineItemAction({
        orgSlug: ctx.orgSlug,
        rfqParam: ctx.rfqParam,
        lineItemId: lineId,
      });
      if (res.ok) setLines((cur) => cur.map((l) => (l.id === tmp ? rowToLine(res.data) : l)));
      return res;
    }, () => setLines((cur) => cur.filter((l) => l.id !== tmp)));
  }

  function deleteTier(lineId: string) {
    const before = lines;
    setLines((cur) => cur.filter((l) => l.id !== lineId));
    setSelected((cur) => {
      const next = new Set(cur);
      next.delete(lineId);
      return next;
    });
    if (!ctx || isTempId(lineId)) return;
    runNow(
      () =>
        deleteQuoteLineItemAction({
          orgSlug: ctx.orgSlug,
          rfqParam: ctx.rfqParam,
          lineItemId: lineId,
        }),
      () => setLines(before),
    );
  }

  function moveTier(partId: string, lineId: string, dir: "up" | "down") {
    if (!ctx) return;
    const partLines = lines.filter((l) => l.partId === partId);
    const i = partLines.findIndex((l) => l.id === lineId);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= partLines.length) return;
    const swapped = [...partLines];
    const a = swapped[i];
    const b = swapped[j];
    if (!a || !b) return;
    swapped[i] = b;
    swapped[j] = a;
    let k = 0;
    const before = lines;
    const reordered = lines.map((l) => (l.partId === partId ? (swapped[k++] ?? l) : l));
    setLines(reordered);
    // Reorder needs the full draft quote's ids; skip while any create is pending.
    if (reordered.some((l) => isTempId(l.id))) return;
    runNow(
      () =>
        reorderQuoteLineItemsAction({
          orgSlug: ctx.orgSlug,
          rfqParam: ctx.rfqParam,
          rfqId: ctx.rfqId,
          orderedIds: reordered.map((l) => l.id),
        }),
      () => setLines(before),
    );
  }

  // ─── Bulk apply: base ← option0 (update); extras → new tiers (add) ─────────────
  function applyBulk() {
    if (!ctx) return;
    const opts = bulkOptions;
    const base = opts[0];
    const sel = lines.filter((l) => selected.has(l.id) && !isTempId(l.id));
    const plan = sel.map((line) => ({
      line,
      before: line,
      extras: opts.slice(1).map((opt) => ({ tmp: newTempId(), opt })),
    }));

    setLines((cur) =>
      cur.flatMap((line) => {
        const p = plan.find((x) => x.line.id === line.id);
        if (!p) return [line];
        const updatedBase = base
          ? priced({ ...line, markup: base.markup, leadTimeWeeks: parseWeeks(base.leadTime) })
          : line;
        const extraLines = p.extras.map(({ tmp, opt }) =>
          priced({
            ...line,
            id: tmp,
            markup: opt.markup,
            leadTimeWeeks: parseWeeks(opt.leadTime),
            tierLabel: null,
          }),
        );
        return [updatedBase, ...extraLines];
      }),
    );

    for (const p of plan) {
      if (base) {
        runNow(
          () =>
            updateQuoteLineItemAction({
              orgSlug: ctx.orgSlug,
              rfqParam: ctx.rfqParam,
              lineItemId: p.line.id,
              patch: { markupPct: parseMarkupNum(base.markup), leadTimeWeeks: parseWeeks(base.leadTime) },
            }),
          () => setLines((cur) => cur.map((l) => (l.id === p.line.id ? p.before : l))),
        );
      }
      for (const { tmp, opt } of p.extras) {
        runNow(async () => {
          const res = await addQuoteLineItemAction({
            orgSlug: ctx.orgSlug,
            rfqParam: ctx.rfqParam,
            rfqId: ctx.rfqId,
            input: {
              partId: p.line.partId,
              quantity: p.line.quantity,
              costPerUnitCents: p.line.costPerUnitCents,
              markupPct: parseMarkupNum(opt.markup),
              leadTimeWeeks: parseWeeks(opt.leadTime),
            },
          });
          if (res.ok) setLines((cur) => cur.map((l) => (l.id === tmp ? rowToLine(res.data) : l)));
          return res;
        }, () => setLines((cur) => cur.filter((l) => l.id !== tmp)));
      }
    }
    resetBulkOptions();
    setBulkDismissed(true);
    setSelected(new Set());
  }

  // ─── Notes (debounced) ────────────────────────────────────────────────────────
  function editQuoteNote(value: string) {
    const before = quoteNote;
    setQuoteNote(value);
    if (!ctx) return;
    schedule(
      "quoteNote",
      () =>
        updateQuoteNotesAction({
          orgSlug: ctx.orgSlug,
          rfqParam: ctx.rfqParam,
          rfqId: ctx.rfqId,
          notesForCustomer: value,
        }),
      () => setQuoteNote(before),
    );
  }

  function editPartNote(partId: string, value: string) {
    const before = notes[partId] ?? "";
    setNotes((p) => ({ ...p, [partId]: value }));
    if (!ctx) return;
    schedule(
      `partNote:${partId}`,
      () =>
        updateQuotePartNoteAction({
          orgSlug: ctx.orgSlug,
          rfqParam: ctx.rfqParam,
          partId,
          note: value,
        }),
      () => setNotes((p) => ({ ...p, [partId]: before })),
    );
  }

  // ─── Selection / bulk-panel / groups (session-only) ────────────────────────────
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
    setBulkOptions((prev) => [...prev, { id: `opt-${optionSeq.current++}`, leadTime: "", markup: "" }]);
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
  function cancelBulk() {
    resetBulkOptions();
    setBulkDismissed(true);
  }
  function addGroup() {
    if (selected.size === 0) return;
    setGroups((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: groupName.trim() || `Group ${prev.length + 1}`, lineIds: [...selected] },
    ]);
  }
  function groupSubtotal(group: QuoteGroup): number {
    return lines.filter((l) => group.lineIds.includes(l.id)).reduce((sum, l) => sum + dispTotal(l), 0);
  }

  function preview() {
    if (!ctx) return;
    const snapshot = buildSnapshot(parts, lines, notes, quoteNote, rfqNumber ?? 0, roundUnit);
    saveQuoteSnapshot(ctx.rfqId, snapshot);
    router.push(`/${ctx.orgSlug}/rfqs/${ctx.rfqParam}/send`);
  }

  const colSpanRest = showMarkup ? 8 : 6;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col bg-white">
        <div className="flex flex-1 overflow-auto">
          {/* Main column */}
          <div className="min-w-0 flex-1 p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
                {saving && <span className="text-xs text-gray-400">{t("saving")}</span>}
              </div>
              <div className="flex items-center gap-5">
                <ToggleSwitch label={t("show_no_bid")} checked={showNoBid} onChange={setShowNoBid} />
                <ToggleSwitch
                  label={t("show_markup")}
                  checked={showMarkup}
                  onChange={(v) => {
                    setShowMarkup(v);
                    if (v) setBulkDismissed(false);
                  }}
                />
                <ToggleSwitch label={t("round_unit")} checked={roundUnit} onChange={setRoundUnit} />
              </div>
            </div>

            {lines.length === 0 && ctx && parts.some((p) => !p.noBid) && (
              <div className="mb-4 flex items-center justify-between rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-500">{t("empty_hint")}</span>
                <button
                  type="button"
                  onClick={generateFromEstimate}
                  className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
                >
                  {t("generate_from_estimate")}
                </button>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left align-bottom text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">{t("col_items")}</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
                    {t("col_select_all")}{" "}
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={t("col_select_all")}
                      className="ml-1 align-middle accent-[hsl(var(--primary))]"
                    />
                  </th>
                  <th className="px-2 py-2 text-right font-medium">{t("col_quantity")}</th>
                  {showMarkup && <th className="px-2 py-2 text-right font-medium">{t("col_estimate_unit")}</th>}
                  {showMarkup && <th className="px-2 py-2 text-right font-medium">{t("col_markup")}</th>}
                  <th className="px-2 py-2 text-right font-medium">{t("col_quote_unit")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("col_quote_total")}</th>
                  <th className="px-2 py-2 text-left font-medium">{t("col_tier")}</th>
                  <th className="px-2 py-2 text-left font-medium">{t("col_lead_time")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleParts.map((part) => {
                  const partLines = lines.filter((l) => l.partId === part.partId);
                  const rowCount = part.noBid ? 1 : Math.max(partLines.length, 1);
                  const itemsCell = (
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
                              <span className="ml-1 font-normal text-gray-400">Rev {part.revision}</span>
                            )}
                          </div>
                          <div className="truncate text-xs text-gray-400">{part.description}</div>
                          {!part.noBid && (
                            <>
                              <NoteCell
                                value={notes[part.partId] ?? ""}
                                editing={editingNote === part.partId}
                                addLabel={t("add_note")}
                                onOpen={() => setEditingNote(part.partId)}
                                onChange={(v) => editPartNote(part.partId, v)}
                                onClose={() => setEditingNote(null)}
                              />
                              {ctx && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    addTier(
                                      part,
                                      part.estimateByQty[0]?.quantity ?? 1,
                                      part.estimateByQty[0]?.costPerUnitCents ?? 0,
                                    )
                                  }
                                  className="mt-2 block text-xs font-medium text-[hsl(var(--primary))] hover:underline"
                                >
                                  + {t("add_tier")}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  );

                  if (part.noBid) {
                    return (
                      <tr key={part.partId} className="text-gray-400">
                        {itemsCell}
                        <td className="border-b border-gray-200 px-2 py-3 text-right" colSpan={2}>
                          —
                        </td>
                        {showMarkup && <td className="border-b border-gray-200 px-2 py-3 text-right" colSpan={2}>—</td>}
                        <td className="border-b border-gray-200 px-2 py-3 text-right text-[11px] uppercase tracking-wide" colSpan={2}>
                          {t("no_bid")}
                        </td>
                        <td className="border-b border-gray-200 px-2 py-3" colSpan={3} />
                      </tr>
                    );
                  }

                  if (partLines.length === 0) {
                    return (
                      <tr key={part.partId}>
                        {itemsCell}
                        <td
                          colSpan={colSpanRest}
                          className="border-b border-gray-200 px-2 py-4 text-center text-xs text-gray-400"
                        >
                          {t("no_tiers")}
                        </td>
                      </tr>
                    );
                  }

                  return partLines.map((line, idx) => (
                    <tr key={line.id} className="hover:bg-gray-50/60">
                      {idx === 0 && itemsCell}
                      <td className="border-b border-gray-200 px-2 py-3 text-right">
                        <input
                          type="checkbox"
                          checked={selected.has(line.id)}
                          onChange={() => toggleSelect(line.id)}
                          aria-label={t("select_line")}
                          className="accent-[hsl(var(--primary))]"
                        />
                      </td>
                      <td className="border-b border-gray-200 px-2 py-3 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={String(line.quantity)}
                          onChange={(e) => {
                            const q = Math.max(1, Math.round(parseDecimal(e.target.value) || 0));
                            editLine(line.id, { quantity: q }, "quantity");
                          }}
                          aria-label={t("col_quantity")}
                          className="w-16 rounded border border-gray-200 px-1.5 py-1 text-right tabular-nums outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                        />
                      </td>
                      {showMarkup && (
                        <td className="border-b border-gray-200 px-2 py-3 text-right tabular-nums text-sky-600">
                          {money(line.costPerUnitCents)}
                        </td>
                      )}
                      {showMarkup && (
                        <td className="border-b border-gray-200 px-2 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={line.markup}
                              onChange={(e) => editLine(line.id, { markup: e.target.value }, "markup")}
                              aria-label={t("col_markup")}
                              className="w-12 bg-transparent text-right tabular-nums outline-none"
                            />
                            <span className="text-gray-400">%</span>
                          </span>
                        </td>
                      )}
                      <td className="border-b border-gray-200 px-2 py-3 text-right font-medium tabular-nums text-gray-900">
                        {money(dispUnit(line))}
                      </td>
                      <td className="border-b border-gray-200 px-2 py-3 text-right font-medium tabular-nums text-gray-900">
                        {money(dispTotal(line))}
                      </td>
                      <td className="border-b border-gray-200 px-2 py-3">
                        <input
                          type="text"
                          value={line.tierLabel ?? ""}
                          onChange={(e) =>
                            editLine(line.id, { tierLabel: e.target.value.trim() === "" ? null : e.target.value }, "tierLabel")
                          }
                          placeholder={t("tier_placeholder")}
                          aria-label={t("col_tier")}
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                        />
                      </td>
                      <td className="border-b border-gray-200 px-2 py-3">
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={line.leadTimeWeeks == null ? "" : String(line.leadTimeWeeks)}
                            onChange={(e) =>
                              editLine(line.id, { leadTimeWeeks: parseWeeks(e.target.value) }, "leadTime")
                            }
                            aria-label={t("col_lead_time")}
                            className="w-14 rounded border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                          />
                          <span className="text-xs text-gray-400">{t("weeks")}</span>
                        </span>
                      </td>
                      <td className="border-b border-gray-200 px-2 py-3">
                        <div className="flex items-center justify-end gap-1.5 text-gray-300">
                          <button
                            type="button"
                            onClick={() => moveTier(part.partId, line.id, "up")}
                            disabled={idx === 0}
                            aria-label={t("move_up")}
                            className="transition-colors hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTier(part.partId, line.id, "down")}
                            disabled={idx === partLines.length - 1}
                            aria-label={t("move_down")}
                            className="transition-colors hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateTier(line.id)}
                            aria-label={t("duplicate_tier")}
                            className="transition-colors hover:text-gray-600"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTier(line.id)}
                            aria-label={t("delete_line")}
                            className="transition-colors hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>

            {selectedLines.length > 0 && (
              <div className="mt-6 flex justify-end">
                <div className="w-[26rem]">
                  <div className="text-right text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    {t("selected_count", { count: selectedLines.length })}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className="text-sm text-gray-500">{t("estimate_total")}</span>
                    <span className="w-28 text-right text-base font-bold tabular-nums text-gray-900">
                      {money(selEstimateTotal)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="text-sm text-gray-500">{t("quote_total")}</span>
                    <span className="w-28 text-right text-base font-bold tabular-nums text-gray-900">
                      {money(selQuoteTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                aria-label={t("group_name")}
                className="w-32 rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
              <button
                type="button"
                onClick={addGroup}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t("add_group_total")}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={t("about_group_totals")} className="text-gray-400 hover:text-gray-600">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t("group_total_help")}
                </TooltipContent>
              </Tooltip>
            </div>

            {groups.length > 0 && (
              <div className="mt-3 space-y-1">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-gray-900">{money(groupSubtotal(g))}</span>
                      <button
                        type="button"
                        onClick={() => setGroups((prev) => prev.filter((x) => x.id !== g.id))}
                        aria-label={t("remove_group")}
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
                  {t("update_selected", { count: selectedLines.length })}
                </h2>
                <div className="mt-3 flex items-center gap-3 text-xs font-medium text-gray-600">
                  <span className="flex-1">{t("col_lead_time")}</span>
                  <span className="w-20 text-right">{t("col_markup")}</span>
                  <span className="w-4 shrink-0" />
                </div>
                <div className="mt-1.5 space-y-2">
                  {bulkOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={opt.leadTime}
                        onChange={(e) => updateOption(opt.id, { leadTime: e.target.value })}
                        placeholder={t("weeks")}
                        aria-label={t("col_lead_time")}
                        className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                      />
                      <span className="flex w-20 shrink-0 items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={opt.markup}
                          onChange={(e) => updateOption(opt.id, { markup: e.target.value })}
                          placeholder="0"
                          aria-label={t("col_markup")}
                          className="w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
                        />
                        <span className="text-gray-400">%</span>
                      </span>
                      {i > 0 ? (
                        <button
                          type="button"
                          onClick={() => removeOption(opt.id)}
                          aria-label={t("remove_option")}
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
                  {t("add_option")}
                </button>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelBulk}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={applyBulk}
                    className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary)/0.9)]"
                  >
                    {t("apply")}
                  </button>
                </div>
              </div>
            )}

            <h2 className="text-sm font-semibold text-gray-900">{t("customer_info")}</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Field label={t("contact")} value={customer?.contact ?? "—"} />
              <Field label={t("organization")} value={customer?.organization ?? "—"} />
            </dl>

            <h2 className="mt-6 text-sm font-semibold text-gray-900">{t("add_notes")}</h2>
            <textarea
              value={quoteNote}
              onChange={(e) => editQuoteNote(e.target.value)}
              rows={6}
              aria-label={t("add_notes")}
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
            {t("preview_quote")}
          </button>
        </div>
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
  addLabel,
  onOpen,
  onChange,
  onClose,
}: {
  value: string;
  editing: boolean;
  addLabel: string;
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
      {addLabel}
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
