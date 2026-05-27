"use client";

import { useState } from "react";
import { createOrUpdateQuote } from "./actions";

export interface QuoteLineItem {
  partId: string;
  partLabel: string;
  quantity: number;
  costPerUnitCents: number;
  markupPct: number;
  quotePriceCents: number;
  leadTimeWeeks: number | null;
  isNoBid: boolean;
}

interface Props {
  orgSlug: string;
  rfqId: string;
  lineItems: QuoteLineItem[];
  notesForCustomer: string;
  hasDraft: boolean;
  draftQuoteId: string | null;
  labels: {
    part: string;
    qty: string;
    costPerUnit: string;
    markupPct: string;
    quotePrice: string;
    leadTimeWeeks: string;
    noBid: string;
    notesForCustomer: string;
    create: string;
    update: string;
    downloadPdf: string;
    goToSend: string;
    showCost: string;
    hideCost: string;
  };
}

function centsToEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function QuoteForm({
  orgSlug,
  rfqId,
  lineItems,
  notesForCustomer,
  hasDraft,
  draftQuoteId,
  labels,
}: Props) {
  const [showCost, setShowCost] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowCost((v) => !v)}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] border border-[hsl(var(--border))] rounded px-2 py-1 transition-colors"
        >
          {showCost ? labels.hideCost : labels.showCost}
        </button>
      </div>

      <form action={createOrUpdateQuote}>
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="rfqId" value={rfqId} />

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              <th className="text-left pb-2">{labels.part}</th>
              <th className="text-right pb-2">{labels.qty}</th>
              {showCost && <th className="text-right pb-2">{labels.costPerUnit}</th>}
              {showCost && <th className="text-right pb-2">{labels.markupPct}</th>}
              <th className="text-right pb-2">{labels.quotePrice}</th>
              <th className="text-right pb-2">{labels.leadTimeWeeks}</th>
              <th className="text-center pb-2">{labels.noBid}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {lineItems.map((li, i) => (
              <tr key={`${li.partId}-${li.quantity}`}>
                <input type="hidden" name={`lineItems[${i}][partId]`} value={li.partId} />
                <input type="hidden" name={`lineItems[${i}][quantity]`} value={String(li.quantity)} />
                <input type="hidden" name={`lineItems[${i}][costPerUnitCents]`} value={String(li.costPerUnitCents)} />
                {/* When cost panel hidden, preserve markup as hidden input so it isn't lost on save */}
                {!showCost && (
                  <input type="hidden" name={`lineItems[${i}][markupPct]`} value={String(li.markupPct)} />
                )}
                <td className="py-2 text-sm">{li.partLabel}</td>
                <td className="py-2 text-right font-mono">{li.quantity}</td>
                {showCost && (
                  <td className="py-2 text-right">€{centsToEuros(li.costPerUnitCents)}</td>
                )}
                {showCost && (
                  <td className="py-2 text-right">
                    <input
                      name={`lineItems[${i}][markupPct]`}
                      type="number"
                      min="0"
                      step="0.5"
                      defaultValue={String(li.markupPct)}
                      className="w-20 text-right rounded border border-[hsl(var(--border))] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                    />
                    %
                  </td>
                )}
                <td className="py-2 text-right font-medium">€{centsToEuros(li.quotePriceCents)}</td>
                <td className="py-2 text-right">
                  <input
                    name={`lineItems[${i}][leadTimeWeeks]`}
                    type="number"
                    min="0"
                    defaultValue={li.leadTimeWeeks !== null ? String(li.leadTimeWeeks) : ""}
                    placeholder="—"
                    className="w-16 text-right rounded border border-[hsl(var(--border))] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    name={`lineItems[${i}][isNoBid]`}
                    type="checkbox"
                    value="true"
                    defaultChecked={li.isNoBid}
                    className="rounded"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mb-4">
          <label
            htmlFor="quote-notes"
            className="block text-xs text-[hsl(var(--muted-foreground))] mb-1"
          >
            {labels.notesForCustomer}
          </label>
          <textarea
            id="quote-notes"
            name="notesForCustomer"
            rows={3}
            defaultValue={notesForCustomer}
            className="w-full rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {hasDraft ? labels.update : labels.create}
          </button>

          {hasDraft && draftQuoteId && (
            <>
              <a
                href={`/api/quotes/${draftQuoteId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
              >
                {labels.downloadPdf}
              </a>
              <a
                href={`/${orgSlug}/rfqs/${rfqId}/quote/send`}
                className="rounded border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--muted))] transition-colors"
              >
                {labels.goToSend}
              </a>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
