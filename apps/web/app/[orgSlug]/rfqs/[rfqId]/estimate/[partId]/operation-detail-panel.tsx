"use client";

import { formatAmount, parseDecimal } from "@/lib/quoting/materialCost";
import {
  DEFAULT_HOURLY_RATE_EUR,
  DEFAULT_VOLUME_TIERS,
  type Operation,
  type VolumeTier,
  computeOperationCost,
  opTimeKind,
  operationTimeMinutes,
} from "@/lib/quoting/operationCost";
import { cn } from "@uptool/ui";
import { Plus, RotateCcw, X } from "lucide-react";
import { QTY_COL_W, ROW_ICON_W } from "./pricing-layout";

/** "80,00" — the €/h amount with two decimals (de-DE). */
function formatRateAmount(eurPerHour: number): string {
  return eurPerHour.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Total time at a quantity expressed in hours, e.g. "3 hr". */
function formatHours(min: number): string {
  return `${(min / 60).toLocaleString("de-DE", { maximumFractionDigits: 2 })} hr`;
}

interface Props {
  op: Operation;
  quantities: number[];
  onChange: (patch: Partial<Operation>) => void;
}

/** Expanded operation detail: rates, volume discount, note, markup, and the
 *  total-time price grid with editable (overridable) cells. */
export function OperationDetailPanel({ op, quantities, onChange }: Props) {
  const { hasSetup, hasRun } = opTimeKind(op.type);

  return (
    <div className="border-t border-gray-200 px-3 py-3">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        {/* Volume discount. The op-level "+ Note" button is hidden until the
            fields-jsonb epic — there's no DB column for an op note yet (ADR 0020).
            Part-level External/Internal notes persist separately. */}
        <div className="space-y-3">
          <VolumeDiscountControl op={op} onChange={onChange} />
        </div>

        {/* Rates */}
        <div className="space-y-3">
          {hasSetup && (
            <RateField
              label="Setup Rate"
              rate={op.setupRate}
              onRateChange={(setupRate) => onChange({ setupRate })}
            />
          )}
          {hasRun && (
            <RateField
              label="Runtime Rate"
              rate={op.runtimeRate}
              onRateChange={(runtimeRate) => onChange({ runtimeRate })}
            />
          )}
        </div>

        {/* Price grid */}
        <PriceGrid op={op} quantities={quantities} onChange={onChange} />
      </div>
    </div>
  );
}

function VolumeDiscountControl({ op, onChange }: { op: Operation; onChange: Props["onChange"] }) {
  function toggle(checked: boolean) {
    onChange({
      volumeDiscount: checked,
      // Seed default tiers the first time it's enabled.
      volumeTiers: op.volumeTiers.length
        ? op.volumeTiers
        : DEFAULT_VOLUME_TIERS.map((t) => ({ ...t })),
    });
  }

  function setTier(index: number, patch: Partial<VolumeTier>) {
    onChange({ volumeTiers: op.volumeTiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  }
  function addTier() {
    onChange({ volumeTiers: [...op.volumeTiers, { qty: "", discountPct: "" }] });
  }
  function removeTier(index: number) {
    onChange({ volumeTiers: op.volumeTiers.filter((_, i) => i !== index) });
  }

  return (
    <div className="rounded-md bg-white/60">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={op.volumeDiscount}
          onChange={(e) => toggle(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 accent-blue-600"
        />
        Volume Discount
      </label>

      {op.volumeDiscount && (
        <div className="mt-2 w-48 rounded-md border border-gray-200">
          <div className="grid grid-cols-[1fr_1fr_auto] items-center border-b border-gray-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            <span>Quantity</span>
            <span className="text-right">Discount</span>
            <span />
          </div>
          {op.volumeTiers.map((tier, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: tiers are positional, edited in place
              key={i}
              className="group/tier grid grid-cols-[1fr_1fr_auto] items-center gap-1 px-2 py-1"
            >
              <TierInput value={tier.qty} suffix="+" onChange={(qty) => setTier(i, { qty })} />
              <TierInput
                value={tier.discountPct}
                suffix="%"
                align="right"
                onChange={(discountPct) => setTier(i, { discountPct })}
              />
              <button
                type="button"
                onClick={() => removeTier(i)}
                aria-label={`Remove tier ${i + 1}`}
                className="text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover/tier:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addTier}
            className="flex w-full items-center gap-1 px-2 py-1 text-xs text-gray-400 transition-colors hover:text-gray-600"
          >
            <Plus className="h-3 w-3" /> Add tier
          </button>
        </div>
      )}
    </div>
  );
}

function TierInput({
  value,
  suffix,
  align = "left",
  onChange,
}: {
  value: string;
  suffix: string;
  align?: "left" | "right";
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        aria-label={`Tier ${suffix === "%" ? "discount" : "quantity"}`}
        className={cn(
          "w-full min-w-0 bg-transparent text-xs text-gray-900 outline-none",
          align === "right" && "text-right",
        )}
      />
      <span className="text-xs text-gray-400">{suffix}</span>
    </div>
  );
}

/** Editable hourly rate: the per-operation €/h amount (persisted as
 *  setup_rate_cents / runtime_rate_cents). Empty shows the €80/h fallback in grey;
 *  any edit is the operation's own rate (blue) and the reset icon clears it back. */
function RateField({
  label,
  rate,
  onRateChange,
}: {
  label: string;
  rate: string;
  onRateChange: (value: string) => void;
}) {
  const hasRate = rate.trim() !== "";
  const display = hasRate ? rate : formatRateAmount(DEFAULT_HOURLY_RATE_EUR);
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="flex items-center gap-1 text-sm">
        <span className="text-gray-500">€</span>
        <input
          value={display}
          onChange={(e) => onRateChange(e.target.value)}
          inputMode="decimal"
          aria-label={`${label} (€/h)`}
          className={cn(
            "w-12 rounded border border-transparent bg-transparent px-0.5 text-right text-sm font-medium tabular-nums outline-none hover:border-gray-200 focus:border-gray-300 focus:bg-white",
            hasRate ? "text-blue-600" : "text-gray-900",
          )}
        />
        <span className="text-gray-500">/h</span>
        {hasRate && (
          <button
            type="button"
            onClick={() => onRateChange("")}
            aria-label={`Reset ${label} to default`}
            className="text-gray-300 transition-colors hover:text-gray-600"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Total-time grid: header (X hr per qty), editable Total + Cost rows, then the
 *  markup-applied row (with the operation markup % input on its left). */
function PriceGrid({ op, quantities, onChange }: Props) {
  // E1: ONE per-unit override per operation. Editing any column's Total cell sets
  // it (= Total / qty); every column recomputes. Empty clears it (revert).
  function setOverride(qty: number, value: string) {
    onChange({
      unitPriceOverride: value.trim() === "" || qty <= 0 ? "" : String(parseDecimal(value) / qty),
    });
  }

  return (
    <div className="ml-auto flex">
      {/* Row labels + markup input */}
      <div className="flex flex-col items-end justify-end pr-2 text-right text-xs text-gray-500">
        <div className="h-4" />
        <div className="flex h-7 items-center">Total</div>
        <div className="flex h-7 items-center">Cost</div>
        <div className="flex h-10 items-center">
          <MarkupInput value={op.markupPct} onChange={(markupPct) => onChange({ markupPct })} />
        </div>
      </div>

      {quantities.map((qty, index) => {
        const c = computeOperationCost(op, qty);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: pricing columns are positional
            key={index}
            style={{ width: QTY_COL_W }}
            className="px-1"
          >
            <div className="pb-1 text-center text-xs text-gray-400">
              {formatHours(operationTimeMinutes(op, qty))}
            </div>
            {/* Total (editable → override). Empty reverts to the calculated value. */}
            <GridCell
              value={formatAmount(c.rawTotal)}
              blue={c.overridden}
              bold
              onChange={(v) => setOverride(qty, v)}
            />
            {/* Cost (per-unit), read-only; blue when the column is overridden. */}
            <GridCell value={formatAmount(c.rawPerUnit)} blue={c.overridden} readOnly />
            {/* Markup-applied final total / per-unit. */}
            <div className="mt-1 text-right text-sm tabular-nums">
              <div
                className={cn("font-semibold", c.overridden ? "text-blue-600" : "text-gray-900")}
              >
                {formatAmount(c.total)} <span className="text-gray-400">€</span>
              </div>
              <div className={cn(c.overridden ? "text-blue-600" : "text-gray-500")}>
                {formatAmount(c.perUnit)} <span className="text-gray-400">€</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Gutter so the qty columns line up with the collapsed price columns. */}
      <div style={{ width: ROW_ICON_W }} />
    </div>
  );
}

function GridCell({
  value,
  blue,
  bold,
  readOnly,
  onChange,
}: {
  value: string;
  blue?: boolean;
  bold?: boolean;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="mb-1 flex h-7 items-center rounded border border-gray-200 bg-white px-1.5">
      <span className="text-xs text-gray-400">€</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        inputMode="decimal"
        aria-label={readOnly ? "Per-unit cost" : "Total cost (editable)"}
        className={cn(
          "w-full min-w-0 bg-transparent text-right text-sm tabular-nums outline-none",
          bold && "font-semibold",
          blue ? "text-blue-600" : "text-gray-900",
          readOnly && "cursor-default",
        )}
      />
    </div>
  );
}

function MarkupInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative rounded-md border border-gray-200 bg-gray-50 px-2 pb-1 pt-3">
      <span className="pointer-events-none absolute -top-2 left-2 bg-gray-50 px-1 text-[10px] font-medium text-gray-500">
        Markup
      </span>
      <div className="flex items-center gap-0.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          aria-label="Operation markup percent"
          className="w-10 min-w-0 bg-transparent text-right text-sm text-gray-900 outline-none"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  );
}
