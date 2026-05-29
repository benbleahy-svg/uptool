"use client";

import {
  MATERIAL_TYPES,
  type MaterialCard as MaterialCardData,
  type MaterialType,
  ROUND_UP_OPTIONS,
  computeMaterialCost,
  formatAmount,
} from "@/lib/quoting/materialCost";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger, cn } from "@uptool/ui";
import {
  Box,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  Cog,
  Copy,
  Diamond,
  GripVertical,
  type LucideIcon,
  RectangleHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import * as React from "react";
import { FloatingField, FloatingSelect } from "./floating-field";
import { PricingCell } from "./pricing-cell";
import { ROW_ICON_W } from "./pricing-layout";

const TYPE_ICONS: Record<MaterialType, LucideIcon> = {
  "online-round-bar": Diamond,
  "online-rect-bar": Box,
  "full-rect-bar": Box,
  "full-round-bar": Diamond,
  sheet: RectangleHorizontal,
  "pre-cut-blanks": RectangleHorizontal,
  "structural-steel": Box,
  extrusion: Box,
  "customer-provided": UserRound,
  "purchased-component": Cog,
  "expense-material": CircleDollarSign,
  tooling: CircleDollarSign,
  "online-sheet": RectangleHorizontal,
};

interface Props {
  card: MaterialCardData;
  quantities: number[];
  onChange: (patch: Partial<MaterialCardData>) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function MaterialCard({ card, quantities, onChange, onDelete, onCopy }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  // Restrict drag movement to the vertical axis.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  };

  const typeLabel = MATERIAL_TYPES.find((t) => t.id === card.type)?.label ?? "Sheet";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex rounded-lg border border-gray-200 bg-gray-50",
        isDragging && "z-10 opacity-90 shadow-lg",
      )}
    >
      {/* Main column: title row + collapsible body */}
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center gap-2">
          <MaterialTypePicker
            type={card.type}
            label={typeLabel}
            onSelect={(type) => onChange({ type })}
          />
          <button
            type="button"
            onClick={() => onChange({ collapsed: !card.collapsed })}
            aria-label={card.collapsed ? "Expand material" : "Collapse material"}
            aria-expanded={!card.collapsed}
            className="ml-auto text-gray-400 transition-colors hover:text-gray-600"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </button>
        </div>

        {!card.collapsed &&
          (card.type === "sheet" ? (
            <SheetBody card={card} onChange={onChange} />
          ) : (
            <div className="mt-3 rounded-md border border-dashed border-gray-300 bg-white/50 p-6 text-center text-sm text-gray-400">
              {typeLabel} body — coming soon
            </div>
          ))}
      </div>

      {/* Per-qty pricing (bottom-aligned, stays visible when collapsed) */}
      <div className="flex flex-none items-end py-3">
        {quantities.map((qty, index) => {
          const { total, perUnit } = computeMaterialCost(card, qty);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: pricing columns are positional
            <PricingCell key={index} total={total} perUnit={perUnit} />
          );
        })}
      </div>

      {/* Far-right icon stack */}
      <div
        style={{ width: ROW_ICON_W }}
        className="flex flex-none flex-col items-center justify-between py-3 text-gray-400"
      >
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete material"
          className="transition-colors hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Drag to reorder"
          className="cursor-grab touch-none transition-colors hover:text-gray-700"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy material"
          className="transition-colors hover:text-gray-700"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MaterialTypePicker({
  type,
  label,
  onSelect,
}: {
  type: MaterialType;
  label: string;
  onSelect: (type: MaterialType) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const TriggerIcon = TYPE_ICONS[type];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm shadow-sm transition-colors hover:bg-gray-50"
        >
          <TriggerIcon className="h-4 w-4 text-gray-600" />
          <span className="font-semibold text-gray-900">{label}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-80 overflow-y-auto p-1">
          {MATERIAL_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t.id];
            const selected = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "bg-[hsl(var(--accent))] font-medium text-gray-900"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <Icon className="h-4 w-4 flex-none text-gray-600" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SheetBody({
  card,
  onChange,
}: {
  card: MaterialCardData;
  onChange: (patch: Partial<MaterialCardData>) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <FloatingField
          label="Material"
          value={card.material}
          onChange={(v) => onChange({ material: v })}
          onClear={() => onChange({ material: "" })}
          required
          className="w-44"
        />
        <FloatingField
          label="Thickness"
          value={card.thickness}
          onChange={(v) => onChange({ thickness: v })}
          suffix="cm"
          align="right"
          inputMode="decimal"
          required
          className="w-28"
        />
        <FloatingField
          label="Cost/Weight"
          value={card.costPerWeight}
          onChange={(v) => onChange({ costPerWeight: v })}
          suffix="€/lb"
          align="right"
          inputMode="decimal"
          required
          className="w-36"
        />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="space-y-3">
          <DimsGrid card={card} onChange={onChange} />
          <FloatingField
            label="Full Sheet Cost"
            value={formatAmount(card.fullSheetCost)}
            suffix="€"
            align="right"
            readOnly
            className="w-44"
          />
        </div>
        <div className="space-y-3">
          <FloatingField
            label="Add Blanks"
            value={card.addBlanks}
            onChange={(v) => onChange({ addBlanks: v })}
            inputMode="numeric"
            className="w-40"
          />
          <FloatingSelect
            label="Round Up"
            value={card.roundUp}
            options={ROUND_UP_OPTIONS}
            onChange={(v) => onChange({ roundUp: v })}
            className="w-40"
          />
        </div>
      </div>
    </div>
  );
}

function DimsGrid({
  card,
  onChange,
}: {
  card: MaterialCardData;
  onChange: (patch: Partial<MaterialCardData>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid grid-cols-[auto_3.5rem_3.5rem] items-center gap-x-2 gap-y-1">
        <span />
        <span className="text-center text-[10px] font-medium text-gray-500">Length</span>
        <span className="text-center text-[10px] font-medium text-gray-500">Width</span>
        <span className="text-xs text-gray-500">Unfolded</span>
        <MiniInput
          label="Unfolded length"
          value={card.unfoldedLength}
          onChange={(v) => onChange({ unfoldedLength: v })}
        />
        <MiniInput
          label="Unfolded width"
          value={card.unfoldedWidth}
          onChange={(v) => onChange({ unfoldedWidth: v })}
        />
        <span className="text-xs text-gray-500">Blank</span>
        <MiniInput
          label="Blank length"
          value={card.blankLength}
          onChange={(v) => onChange({ blankLength: v })}
        />
        <MiniInput
          label="Blank width"
          value={card.blankWidth}
          onChange={(v) => onChange({ blankWidth: v })}
        />
      </div>
      <span className="text-sm text-gray-500">cm</span>
    </div>
  );
}

function MiniInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const invalid = value.trim() === "";
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      inputMode="decimal"
      className={cn(
        "h-7 w-14 rounded border bg-white px-1.5 text-center text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]",
        invalid ? "border-red-400" : "border-gray-200",
      )}
    />
  );
}
