"use client";

import { type MaterialCard, SHEET_CARD_EXAMPLE } from "@/lib/quoting/materialCost";
import { type Operation, operationIsComplete, partIsComplete } from "@/lib/quoting/operationCost";
import {
  Dialog,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@uptool/ui";
import {
  Box,
  ChevronDown,
  ChevronRight,
  FileInput,
  Plus,
  RefreshCw,
  Settings,
  Weight,
  X,
} from "lucide-react";
import * as React from "react";
import { CompletedEstimatesDialog } from "./completed-estimates-dialog";
import { EstimateFooter } from "./estimate-footer";
import { MaterialsSection } from "./materials-section";
import { type Part, WORKFLOW_OPTIONS } from "./mocks/mockPart";
import { NotesSection } from "./notes-section";
import { OperationsSection, seedOperations } from "./operations-section";
import { QTY_COL_W } from "./pricing-layout";
import { TotalRow } from "./total-row";

type Units = "cm" | "mm";

const IN_TO_MM = 25.4;
const IN2_TO_MM2 = 645.16;
const IN3_TO_MM3 = 16387.064;
const IN_TO_CM = 2.54;
const IN2_TO_CM2 = 6.4516;
const IN3_TO_CM3 = 16.387064;

/** German number format: 7,09 / 180,09 (decimal ","), trailing zeros trimmed. */
function fmt(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

interface AiRow {
  field: string;
  value: string;
  verbatim: string;
}

function buildRows(part: Part, units: Units): AiRow[] {
  const u = units;
  const len = units === "mm" ? part.lengthIn * IN_TO_MM : part.lengthIn * IN_TO_CM;
  const wid = units === "mm" ? part.widthIn * IN_TO_MM : part.widthIn * IN_TO_CM;
  const thk = units === "mm" ? part.thicknessIn * IN_TO_MM : part.thicknessIn * IN_TO_CM;
  const area = units === "mm" ? part.surfaceAreaIn2 * IN2_TO_MM2 : part.surfaceAreaIn2 * IN2_TO_CM2;
  const vol = units === "mm" ? part.volumeIn3 * IN3_TO_MM3 : part.volumeIn3 * IN3_TO_CM3;

  return [
    { field: "Description", value: part.description, verbatim: part.descriptionVerbatim },
    { field: "Material", value: part.material, verbatim: part.materialVerbatim },
    { field: "Weight", value: `${fmt(part.weightLb)} lb`, verbatim: "" },
    { field: "Length", value: `${fmt(len)} ${u}`, verbatim: "" },
    { field: "Width", value: `${fmt(wid)} ${u}`, verbatim: "" },
    { field: "Thickness", value: `${fmt(thk)} ${u}`, verbatim: "" },
    { field: "Surface Area", value: `${fmt(area)} ${u}²`, verbatim: "" },
    { field: "Volume", value: `${fmt(vol)} ${u}³`, verbatim: "" },
    { field: "Finish", value: part.finish, verbatim: part.finishVerbatim },
  ];
}

interface CalculatorProps {
  part: Part;
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  partIds: string[];
}

export function Calculator({ part, orgSlug, rfqParam, rfqId, partIds }: CalculatorProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [units, setUnits] = React.useState<Units>("mm");
  const [workflowId, setWorkflowId] = React.useState(part.defaultWorkflowId);
  const [quantities, setQuantities] = React.useState<string[]>(
    part.quantities.map((q) => String(q)),
  );
  const [materials, setMaterials] = React.useState<MaterialCard[]>(() => [
    { id: "material-1", ...SHEET_CARD_EXAMPLE },
  ]);
  const [operations, setOperations] = React.useState<Operation[]>(() =>
    seedOperations(part.surfaceAreaIn2 * IN2_TO_CM2),
  );

  const qtyNumbers = quantities.map((q) => Number(q) || 0);
  const partComplete = partIsComplete({ materials, operations });
  const invalidOpNames = operations.filter((op) => !operationIsComplete(op)).map((op) => op.name);

  const workflowName =
    (WORKFLOW_OPTIONS.find((w) => w.id === workflowId) ?? WORKFLOW_OPTIONS[0])?.name ?? "";
  const rows = buildRows(part, units);

  const u = units;
  const len = units === "mm" ? part.lengthIn * IN_TO_MM : part.lengthIn * IN_TO_CM;
  const wid = units === "mm" ? part.widthIn * IN_TO_MM : part.widthIn * IN_TO_CM;
  const thk = units === "mm" ? part.thicknessIn * IN_TO_MM : part.thicknessIn * IN_TO_CM;
  const area = units === "mm" ? part.surfaceAreaIn2 * IN2_TO_MM2 : part.surfaceAreaIn2 * IN2_TO_CM2;
  const vol = units === "mm" ? part.volumeIn3 * IN3_TO_MM3 : part.volumeIn3 * IN3_TO_CM3;

  // Seeded quantities are what the customer requested — only added ones are removable.
  const originalQtyCount = part.quantities.length;

  function updateQty(index: number, value: string) {
    setQuantities((prev) => prev.map((q, i) => (i === index ? value : q)));
  }

  function removeQty(index: number) {
    setQuantities((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-full flex-col bg-[hsl(var(--background))]">
        <div className="flex-1 overflow-auto">
          {/* Row 1 — part number + units toggle */}
          <div className="flex items-start justify-between gap-4 px-5 pb-1 pt-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Part
              </div>
              <h1 className="truncate text-xl font-bold leading-tight">
                {part.partNumber}
                {part.revision ? (
                  <span className="ml-1.5 font-semibold text-[hsl(var(--muted-foreground))]">
                    Rev {part.revision}
                  </span>
                ) : null}
              </h1>
            </div>
            <UnitsToggle units={units} onChange={setUnits} />
          </div>

          {/* Collapsible part info */}
          <div className="flex gap-2 px-5 pb-4">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              className="mt-0.5 flex-none text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                <span>
                  Description:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {part.description}
                  </span>
                </span>
                <span>
                  Material:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {part.material}
                  </span>
                </span>
                <span>
                  Finish:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">{part.finish}</span>
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-1.5">
                  <Box className="h-3.5 w-3.5" />
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {fmt(len)} × {fmt(wid)} × {fmt(thk)}
                  </span>{" "}
                  {u}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Weight className="h-3.5 w-3.5" />
                  <span className="font-semibold text-[hsl(var(--foreground))]">
                    {fmt(part.weightLb)}
                  </span>{" "}
                  lb
                </span>
                <span>
                  Area:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">{fmt(area)}</span>{" "}
                  {u}²
                </span>
                <span>
                  Volume:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">{fmt(vol)}</span>{" "}
                  {u}³
                </span>
              </div>

              {expanded && (
                <div className="mt-3 overflow-hidden rounded-md border border-[hsl(var(--border))]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))] text-left text-xs text-[hsl(var(--muted-foreground))]">
                        <th className="px-3 py-2 font-medium">Field</th>
                        <th className="px-3 py-2 font-medium">Value</th>
                        <th className="px-3 py-2 font-medium">Verbatim</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                      {rows.map((row) => (
                        <tr key={row.field} className="align-top">
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                            {row.field}
                          </td>
                          <td className="px-3 py-2 font-semibold">{row.value}</td>
                          <td className="px-3 py-2 italic text-[hsl(var(--muted-foreground))]">
                            {row.verbatim}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block rounded bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--primary))]">
                              {part.source}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sticky toolbar — workflow + qty */}
          <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-[hsl(var(--foreground))] px-3.5 text-sm text-[hsl(var(--background))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                >
                  <span>
                    <span className="font-semibold">{workflowName}</span>{" "}
                    <span className="font-normal opacity-80">Workflow</span>
                  </span>
                  <span className="opacity-40">|</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {WORKFLOW_OPTIONS.map((w) => (
                  <DropdownMenuItem key={w.id} onSelect={() => setWorkflowId(w.id)}>
                    {w.name} Workflow
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ToolbarIcon label="Settings">
              <Settings className="h-[18px] w-[18px]" />
            </ToolbarIcon>

            <Dialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Import from prior estimate"
                      className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                    >
                      <FileInput className="h-[18px] w-[18px]" />
                    </button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Import from prior estimate</TooltipContent>
              </Tooltip>
              <CompletedEstimatesDialog />
            </Dialog>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Re-run AI on part files"
                  onClick={() => console.log("Re-run AI on part files")}
                  className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                >
                  <RefreshCw className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Re-run AI on part files</TooltipContent>
            </Tooltip>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">Qty:</span>
              <div className="flex h-9 items-center overflow-hidden rounded-md border border-[hsl(var(--border))]">
                {quantities.map((qty, index) => {
                  const deletable = index >= originalQtyCount;
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: quantity columns are positional
                      key={index}
                      style={{ width: QTY_COL_W }}
                      className={cn(
                        "relative h-full",
                        index > 0 && "border-l border-[hsl(var(--border))]",
                      )}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        value={qty}
                        onChange={(e) => updateQty(index, e.target.value)}
                        aria-label={`Quantity ${index + 1}`}
                        className="h-full w-full bg-[hsl(var(--background))] px-2 text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[hsl(var(--ring))]"
                      />
                      {deletable && (
                        <button
                          type="button"
                          onClick={() => removeQty(index)}
                          aria-label={`Remove quantity ${index + 1}`}
                          className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--destructive))]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setQuantities((prev) => [...prev, ""])}
                aria-label="Add quantity column"
                className="grid h-8 w-8 flex-none place-items-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable middle */}
          <MaterialsSection quantities={qtyNumbers} cards={materials} setCards={setMaterials} />
          <OperationsSection
            quantities={qtyNumbers}
            partAreaCm2={part.surfaceAreaIn2 * IN2_TO_CM2}
            operations={operations}
            setOperations={setOperations}
          />
          <NotesSection />

          {/* Sticky total row — pinned to the bottom of the scroll area */}
          <TotalRow materials={materials} operations={operations} quantities={qtyNumbers} />
        </div>

        {/* Footer — pinned to the bottom of the pane, outside the scroll */}
        <EstimateFooter
          orgSlug={orgSlug}
          rfqParam={rfqParam}
          rfqId={rfqId}
          partIds={partIds}
          currentPartId={part.id}
          complete={partComplete}
          invalidOpNames={invalidOpNames}
        />
      </div>
    </TooltipProvider>
  );
}

function UnitsToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <div className="inline-flex flex-none rounded-full border border-[hsl(var(--border))] p-0.5 text-xs">
      {(["cm", "mm"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-2.5 py-0.5 transition-colors",
            units === value
              ? "bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

function ToolbarIcon({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
    >
      {children}
    </button>
  );
}
