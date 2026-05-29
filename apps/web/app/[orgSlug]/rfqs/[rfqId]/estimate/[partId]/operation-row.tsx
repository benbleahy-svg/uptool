"use client";

import {
  OPERATION_CATALOGUE,
  type OpFieldDef,
  type Operation,
  type OperationType,
  computeOperationCost,
  operationIsComplete,
} from "@/lib/quoting/operationCost";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@uptool/ui";
import {
  ChevronsUpDown,
  Clock,
  Copy,
  GripVertical,
  type LucideIcon,
  Settings,
  SprayCan,
  Trash2,
  Zap,
} from "lucide-react";
import * as React from "react";
import { FloatingField, FloatingSelect } from "./floating-field";
import { EmptyPricingCell, PricingCell } from "./pricing-cell";
import { ROW_ICON_W } from "./pricing-layout";

const OP_ICONS: Record<OperationType, LucideIcon> = {
  programming: Clock,
  "laser-cutting": Zap,
  deburr: Clock,
  bending: Clock,
  finishing: SprayCan,
  inspection: Clock,
  "cnc-milling": Clock,
  "pack-and-ship": Clock,
  generic: Clock,
};

interface Props {
  op: Operation;
  quantities: number[];
  onChange: (patch: Partial<Operation>) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function OperationRow({ op, quantities, onChange, onDelete, onCopy }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: op.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  };

  const [editing, setEditing] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);
  const Icon = OP_ICONS[op.type];
  const def = OPERATION_CATALOGUE[op.type];
  const complete = operationIsComplete(op);

  const setField = (key: string, value: string) =>
    onChange({ fields: { ...op.fields, [key]: value } });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex rounded-lg border border-gray-200 bg-gray-50",
        isDragging && "z-10 opacity-90 shadow-lg",
      )}
    >
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 flex-none text-gray-500" />
          {editing ? (
            <input
              ref={nameInputRef}
              value={op.name}
              onChange={(e) => onChange({ name: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditing(false);
              }}
              aria-label="Operation name"
              className="rounded border border-gray-300 px-1.5 py-0.5 text-sm font-semibold text-gray-900 outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          ) : (
            <OperationName op={op} onEdit={() => setEditing(true)} />
          )}
          <OperationSettings />
        </div>

        {!op.collapsed && (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {def.fields.map((field) => (
              <OpField
                key={field.key}
                def={field}
                value={op.fields[field.key] ?? ""}
                onChange={(v) => setField(field.key, v)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-none items-center px-2">
        <button
          type="button"
          onClick={() => onChange({ collapsed: !op.collapsed })}
          aria-label={op.collapsed ? "Expand operation" : "Collapse operation"}
          aria-expanded={!op.collapsed}
          className="text-gray-400 transition-colors hover:text-gray-600"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-none items-center py-3">
        {quantities.map((qty, index) => {
          const cost = complete ? computeOperationCost(op, qty) : null;
          return cost ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: pricing columns are positional
            <PricingCell key={index} total={cost.total} perUnit={cost.perUnit} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: pricing columns are positional
            <EmptyPricingCell key={index} />
          );
        })}
      </div>

      <div
        style={{ width: ROW_ICON_W }}
        className="flex flex-none flex-col items-center justify-between py-3 text-gray-400"
      >
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete operation"
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
          aria-label="Copy operation"
          className="transition-colors hover:text-gray-700"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OperationName({ op, onEdit }: { op: Operation; onEdit: () => void }) {
  const button = (
    <button
      type="button"
      onClick={onEdit}
      className="truncate text-sm font-semibold text-gray-900 hover:underline"
    >
      {op.name}
    </button>
  );

  // Programming (and other non-recurring ops) show a badge on hover when collapsed.
  if (op.nonRecurring && op.collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top">Non-Recurring Time-Dependent</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

function OperationSettings() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Operation settings"
          className="ml-1 flex-none text-gray-400 opacity-0 transition-opacity hover:text-gray-600 group-hover:opacity-100"
        >
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="bottom-0 left-auto right-0 top-0 h-full w-full max-w-sm translate-x-0 translate-y-0 rounded-none border-l">
        <DialogTitle>Operation settings</DialogTitle>
        <DialogDescription>
          Coming soon — per-operation configuration will live here.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

function OpField({
  def,
  value,
  onChange,
}: {
  def: OpFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  if (def.kind === "dropdown") {
    return (
      <FloatingSelect
        label={def.label}
        value={value}
        options={def.options ?? []}
        onChange={onChange}
        onClear={def.clearable ? () => onChange("") : undefined}
        required={def.required}
        className={def.width}
      />
    );
  }
  return (
    <FloatingField
      label={def.label}
      value={value}
      onChange={onChange}
      prefix={def.prefix}
      suffix={def.unit}
      required={def.required}
      readOnly={def.readOnly}
      align={def.align}
      onClear={def.clearable ? () => onChange("") : undefined}
      inputMode={def.kind === "number" ? "decimal" : undefined}
      className={def.width}
    />
  );
}
