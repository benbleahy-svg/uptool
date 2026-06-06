"use client";

import { type MaterialCard, emptyCard } from "@/lib/quoting/materialCost";
import {
  type Operation,
  createOperation,
  operationIsComplete,
  partIsComplete,
} from "@/lib/quoting/operationCost";
import type { DerivedRfqStatus } from "@/lib/rfq-status";
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
import { Box, ChevronDown, ChevronRight, FileInput, Plus, Settings, Weight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import {
  addPartMaterialAction,
  addPartOperationAction,
  clearPartOperationOverrideAction,
  deletePartMaterialAction,
  deletePartOperationAction,
  reorderPartMaterialsAction,
  reorderPartOperationsAction,
  updatePartMaterialAction,
  updatePartNotesAction,
  updatePartOperationAction,
} from "../actions";
import { CompletedEstimatesDialog } from "./completed-estimates-dialog";
import { EstimateFooter } from "./estimate-footer";
import { FIELD_COLORS, SOURCE_STYLES, type SourceType } from "./field-identity";
import { MaterialsSection } from "./materials-section";
import { type Part, WORKFLOW_OPTIONS } from "./mocks/mockPart";
import { NotesSection } from "./notes-section";
import { OperationsSection, resolveType } from "./operations-section";
import {
  clientMaterialToFields,
  clientOpToAddInput,
  clientOpToFullPatch,
  opPatchToSaves,
  revertOpField,
} from "./persistence";
import { QTY_COL_W } from "./pricing-layout";
import { ResetEstimateButton } from "./reset-estimate-button";
import { TotalRow } from "./total-row";
import { useEstimateSync } from "./use-estimate-sync";

/** Temp client id for an optimistically-added row before the server returns its real id. */
const tempId = () => `tmp-${crypto.randomUUID()}`;
const isTempId = (id: string) => id.startsWith("tmp-");

type Units = "cm" | "mm";

/** German number format: 7,09 / 180,09 (decimal ","), trailing zeros trimmed. */
function fmt(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

interface AiRow {
  field: string;
  value: string;
  verbatim: string;
  /** Where this field was read from — drives the Source pill. Text fields come
   *  from the drawing; geometry from the CAD model; weight is derived. */
  source: SourceType;
}

/** Real extracted geometry passed from the DB part row (mm-native). */
export interface PartGeometry {
  status: string | null; // 'pending' | 'processing' | 'ready' | 'failed' | null
  bboxXMm: number | null;
  bboxYMm: number | null;
  bboxZMm: number | null;
  volumeMm3: number | null;
  surfaceAreaMm2: number | null;
  cutLengthMm: number | null;
  pierceCount: number | null;
  bendCount: number | null;
  /** Density of the part's selected material (g/cm³), for the weight calc; null = unknown. */
  densityGCm3: number | null;
}

function buildRows(part: Part, units: Units, geometry?: PartGeometry): AiRow[] {
  const u = units;
  const status = geometry?.status ?? null;
  // Placeholder for a geometry field given the extraction status.
  const placeholder =
    status === "pending" || status === "processing"
      ? "Wird berechnet…"
      : status === "failed"
        ? "⚠ —"
        : "—";

  // Format a real geometry value (or the status placeholder if not ready/null).
  const geo = (value: number | null | undefined, render: (v: number) => string): string =>
    status === "ready" && value != null ? render(value) : placeholder;

  const lenDiv = units === "mm" ? 1 : 10; // mm → cm
  const areaDiv = units === "mm" ? 1 : 100; // mm² → cm²
  const volDiv = units === "mm" ? 1 : 1000; // mm³ → cm³

  const volumeCm3 = geometry?.volumeMm3 != null ? geometry.volumeMm3 / 1000 : null;
  const weight =
    status === "ready" && volumeCm3 != null && geometry?.densityGCm3 != null
      ? volumeCm3 * geometry.densityGCm3 // grams
      : null;
  const weightStr =
    weight == null
      ? status === "ready"
        ? "—" // ready but no material density selected
        : placeholder
      : weight >= 1000
        ? `${fmt(weight / 1000)} kg`
        : `${fmt(weight)} g`;

  const rows: AiRow[] = [
    {
      field: "Description",
      value: part.description,
      verbatim: part.descriptionVerbatim,
      source: "Technical Drawing",
    },
    {
      field: "Material",
      value: part.material,
      verbatim: part.materialVerbatim,
      source: "Technical Drawing",
    },
    { field: "Length", value: geo(geometry?.bboxXMm, (v) => `${fmt(v / lenDiv)} ${u}`), verbatim: "", source: "CAD Model" },
    { field: "Width", value: geo(geometry?.bboxYMm, (v) => `${fmt(v / lenDiv)} ${u}`), verbatim: "", source: "CAD Model" },
    { field: "Thickness", value: geo(geometry?.bboxZMm, (v) => `${fmt(v / lenDiv)} ${u}`), verbatim: "", source: "CAD Model" },
    { field: "Surface Area", value: geo(geometry?.surfaceAreaMm2, (v) => `${fmt(v / areaDiv)} ${u}²`), verbatim: "", source: "CAD Model" },
    { field: "Volume", value: geo(geometry?.volumeMm3, (v) => `${fmt(v / volDiv)} ${u}³`), verbatim: "", source: "CAD Model" },
    { field: "Weight", value: weightStr, verbatim: "", source: "Calculated" },
  ];

  // DXF (sheet-metal) extras: cut length / pierces / bends.
  if (status === "ready" && geometry?.cutLengthMm != null) {
    rows.push(
      { field: "Cut Length", value: `${fmt(geometry.cutLengthMm / lenDiv)} ${u}`, verbatim: "", source: "CAD Model" },
      { field: "Pierces", value: `${geometry.pierceCount ?? 0}`, verbatim: "", source: "CAD Model" },
      { field: "Bends", value: `${geometry.bendCount ?? 0}`, verbatim: "", source: "CAD Model" },
    );
  } else if (status === "ready" && geometry?.cutLengthMm == null) {
    // Solid (STEP) part: show the stock-removal ratio (>80% ≈ heavy machining).
    const stock =
      (geometry?.bboxXMm ?? 0) * (geometry?.bboxYMm ?? 0) * (geometry?.bboxZMm ?? 0);
    if (stock > 0 && geometry?.volumeMm3 != null) {
      const removalPct = (Math.max(0, stock - geometry.volumeMm3) / stock) * 100;
      rows.push({
        field: "Material Removal",
        value: `${fmt(removalPct)} %`,
        verbatim: "",
        source: "Calculated",
      });
    }
  }

  rows.push({
    field: "Finish",
    value: part.finish,
    verbatim: part.finishVerbatim,
    source: "Technical Drawing",
  });

  return rows;
}

interface CalculatorProps {
  part: Part;
  orgSlug: string;
  rfqParam: string;
  rfqId: string;
  rfqStatus: DerivedRfqStatus;
  partIds: string[];
  /** Real extracted geometry from the DB part row (null when not extracted yet). */
  geometryData?: PartGeometry;
  /** Canonical estimate state loaded from the DB (mapped to client models). */
  initialOperations: Operation[];
  initialMaterials: MaterialCard[];
  initialNotesExternal: string;
  initialNotesInternal: string;
}

export function Calculator({
  part,
  orgSlug,
  rfqParam,
  rfqId,
  rfqStatus,
  partIds,
  geometryData,
  initialOperations,
  initialMaterials,
  initialNotesExternal,
  initialNotesInternal,
}: CalculatorProps) {
  const t = useTranslations("estimate");
  const sync = useEstimateSync();
  const partId = part.id;

  const [expanded, setExpanded] = React.useState(false);
  const [units, setUnits] = React.useState<Units>("mm");
  const [workflowId, setWorkflowId] = React.useState(part.defaultWorkflowId);
  const [quantities, setQuantities] = React.useState<string[]>(
    part.quantities.map((q) => String(q)),
  );
  const [materials, setMaterials] = React.useState<MaterialCard[]>(initialMaterials);
  const [operations, setOperations] = React.useState<Operation[]>(initialOperations);
  const [notesExternal, setNotesExternal] = React.useState(initialNotesExternal);
  const [notesInternal, setNotesInternal] = React.useState(initialNotesInternal);

  // ─── Operations: optimistic local update + persisted save (see ADR 0020) ────
  function patchOp(id: string, patch: Partial<Operation>) {
    const prevOp = operations.find((o) => o.id === id);
    if (!prevOp) return;
    setOperations((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    if (isTempId(id)) return; // not persisted until the add reconciles
    for (const save of opPatchToSaves(prevOp, patch)) {
      // Field-scoped revert: restore only this save's field from the snapshot,
      // merged onto current state, so a failed save doesn't clobber siblings.
      const revert = () =>
        setOperations((prev) =>
          prev.map((o) => (o.id === id ? revertOpField(o, prevOp, save.key) : o)),
        );
      const thunk =
        save.kind === "clearOverride"
          ? () =>
              clearPartOperationOverrideAction({
                orgSlug,
                rfqParam,
                operationId: id,
                field: "unitPriceOverride",
              })
          : () =>
              updatePartOperationAction({ orgSlug, rfqParam, operationId: id, patch: save.patch });
      sync.schedule(`op:${id}:${save.key}`, thunk, revert);
    }
  }

  function addOp(name: string) {
    const id = tempId();
    const optimistic: Operation = { id, ...createOperation(resolveType(name), { name }) };
    setOperations((prev) => [...prev, optimistic]);
    sync.runNow(
      async () => {
        const res = await addPartOperationAction({
          orgSlug,
          rfqParam,
          partId,
          input: clientOpToAddInput(optimistic),
        });
        if (res.ok) {
          let existed = false;
          setOperations((prev) => {
            existed = prev.some((o) => o.id === id);
            return existed ? prev.map((o) => (o.id === id ? { ...o, id: res.data.id } : o)) : prev;
          });
          // Deleted before the add resolved → remove the orphan we just created.
          if (!existed) {
            void deletePartOperationAction({ orgSlug, rfqParam, operationId: res.data.id }).catch(
              () => {},
            );
          }
        }
        return res;
      },
      () => setOperations((prev) => prev.filter((o) => o.id !== id)),
    );
  }

  function deleteOp(id: string) {
    const snapshot = operations;
    setOperations((prev) => prev.filter((o) => o.id !== id));
    if (isTempId(id)) return;
    sync.runNow(
      () => deletePartOperationAction({ orgSlug, rfqParam, operationId: id }),
      () => setOperations(snapshot),
    );
  }

  function copyOp(id: string) {
    const src = operations.find((o) => o.id === id);
    if (!src) return;
    const newId = tempId();
    const copy: Operation = { ...src, id: newId };
    setOperations((prev) => {
      const i = prev.findIndex((o) => o.id === id);
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    sync.runNow(
      async () => {
        const res = await addPartOperationAction({
          orgSlug,
          rfqParam,
          partId,
          input: clientOpToAddInput(copy),
        });
        if (res.ok) {
          const realId = res.data.id;
          let existed = false;
          setOperations((prev) => {
            existed = prev.some((o) => o.id === newId);
            return existed ? prev.map((o) => (o.id === newId ? { ...o, id: realId } : o)) : prev;
          });
          if (existed) {
            await updatePartOperationAction({
              orgSlug,
              rfqParam,
              operationId: realId,
              patch: clientOpToFullPatch(copy),
            });
          } else {
            void deletePartOperationAction({ orgSlug, rfqParam, operationId: realId }).catch(
              () => {},
            );
          }
        }
        return res;
      },
      () => setOperations((prev) => prev.filter((o) => o.id !== newId)),
    );
  }

  function reorderOps(orderedIds: string[]) {
    const snapshot = operations;
    setOperations(
      (prev) =>
        orderedIds.map((oid) => prev.find((o) => o.id === oid)).filter(Boolean) as Operation[],
    );
    if (orderedIds.some(isTempId)) return;
    sync.runNow(
      () => reorderPartOperationsAction({ orgSlug, rfqParam, partId, orderedIds }),
      () => setOperations(snapshot),
    );
  }

  // ─── Materials: optimistic local update + persisted save ────────────────────
  function patchMat(id: string, patch: Partial<MaterialCard>) {
    const prevCard = materials.find((m) => m.id === id);
    if (!prevCard) return;
    const nextCard = { ...prevCard, ...patch };
    setMaterials((prev) => prev.map((m) => (m.id === id ? nextCard : m)));
    if (isTempId(id)) return;
    sync.schedule(
      `mat:${id}`,
      () =>
        updatePartMaterialAction({
          orgSlug,
          rfqParam,
          materialId: id,
          patch: clientMaterialToFields(nextCard),
        }),
      () => setMaterials((prev) => prev.map((m) => (m.id === id ? prevCard : m))),
    );
  }

  function addMat() {
    const id = tempId();
    const optimistic: MaterialCard = { id, ...emptyCard("sheet") };
    setMaterials((prev) => [...prev, optimistic]);
    sync.runNow(
      async () => {
        const res = await addPartMaterialAction({
          orgSlug,
          rfqParam,
          partId,
          input: clientMaterialToFields(optimistic),
        });
        if (res.ok) {
          let existed = false;
          setMaterials((prev) => {
            existed = prev.some((m) => m.id === id);
            return existed ? prev.map((m) => (m.id === id ? { ...m, id: res.data.id } : m)) : prev;
          });
          if (!existed) {
            void deletePartMaterialAction({ orgSlug, rfqParam, materialId: res.data.id }).catch(
              () => {},
            );
          }
        }
        return res;
      },
      () => setMaterials((prev) => prev.filter((m) => m.id !== id)),
    );
  }

  function deleteMat(id: string) {
    const snapshot = materials;
    setMaterials((prev) => prev.filter((m) => m.id !== id));
    if (isTempId(id)) return;
    sync.runNow(
      () => deletePartMaterialAction({ orgSlug, rfqParam, materialId: id }),
      () => setMaterials(snapshot),
    );
  }

  function copyMat(id: string) {
    const src = materials.find((m) => m.id === id);
    if (!src) return;
    const newId = tempId();
    const copy: MaterialCard = { ...src, id: newId };
    setMaterials((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    sync.runNow(
      async () => {
        const res = await addPartMaterialAction({
          orgSlug,
          rfqParam,
          partId,
          input: clientMaterialToFields(copy),
        });
        if (res.ok) {
          let existed = false;
          setMaterials((prev) => {
            existed = prev.some((m) => m.id === newId);
            return existed
              ? prev.map((m) => (m.id === newId ? { ...m, id: res.data.id } : m))
              : prev;
          });
          if (!existed) {
            void deletePartMaterialAction({ orgSlug, rfqParam, materialId: res.data.id }).catch(
              () => {},
            );
          }
        }
        return res;
      },
      () => setMaterials((prev) => prev.filter((m) => m.id !== newId)),
    );
  }

  function reorderMats(orderedIds: string[]) {
    const snapshot = materials;
    setMaterials(
      (prev) =>
        orderedIds.map((mid) => prev.find((m) => m.id === mid)).filter(Boolean) as MaterialCard[],
    );
    if (orderedIds.some(isTempId)) return;
    sync.runNow(
      () => reorderPartMaterialsAction({ orgSlug, rfqParam, partId, orderedIds }),
      () => setMaterials(snapshot),
    );
  }

  // ─── Notes: debounced persistence ("" clears; controlled value) ─────────────
  function changeNote(field: "external" | "internal", value: string) {
    if (field === "external") {
      const prev = notesExternal;
      setNotesExternal(value);
      sync.schedule(
        "notes:external",
        () => updatePartNotesAction({ orgSlug, rfqParam, partId, patch: { external: value } }),
        () => setNotesExternal(prev),
      );
    } else {
      const prev = notesInternal;
      setNotesInternal(value);
      sync.schedule(
        "notes:internal",
        () => updatePartNotesAction({ orgSlug, rfqParam, partId, patch: { internal: value } }),
        () => setNotesInternal(prev),
      );
    }
  }

  const qtyNumbers = quantities.map((q) => Number(q) || 0);
  const partComplete = partIsComplete({ materials, operations });
  const invalidOpNames = operations.filter((op) => !operationIsComplete(op)).map((op) => op.name);

  const workflowName =
    (WORKFLOW_OPTIONS.find((w) => w.id === workflowId) ?? WORKFLOW_OPTIONS[0])?.name ?? "";
  const rows = buildRows(part, units, geometryData);

  const u = units;
  // Compact-header summary, driven by real geometry (placeholder until ready).
  const geoReady = geometryData?.status === "ready";
  const lenDiv = units === "mm" ? 1 : 10;
  const areaDiv = units === "mm" ? 1 : 100;
  const dimStr =
    geoReady && geometryData?.bboxXMm != null
      ? `${fmt(geometryData.bboxXMm / lenDiv)} × ${fmt((geometryData.bboxYMm ?? 0) / lenDiv)} × ${fmt((geometryData.bboxZMm ?? 0) / lenDiv)}`
      : "—";
  const areaStr =
    geoReady && geometryData?.surfaceAreaMm2 != null
      ? fmt(geometryData.surfaceAreaMm2 / areaDiv)
      : "—";
  const volStr =
    geoReady && geometryData?.volumeMm3 != null
      ? fmt(geometryData.volumeMm3 / (units === "mm" ? 1 : 1000))
      : "—";
  const weightG =
    geoReady && geometryData?.volumeMm3 != null && geometryData?.densityGCm3 != null
      ? (geometryData.volumeMm3 / 1000) * geometryData.densityGCm3
      : null;
  const weightStr =
    weightG == null ? "—" : weightG >= 1000 ? `${fmt(weightG / 1000)} kg` : `${fmt(weightG)} g`;

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
        {/* Fixed header — part info, AI-extraction table, and workflow/qty toolbar
            stay pinned at the top of the left pane while the section below scrolls. */}
        <div className="flex-none">
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
            <div className="flex flex-none items-center gap-3">
              {sync.saving && (
                <span aria-live="polite" className="text-xs text-[hsl(var(--muted-foreground))]">
                  {t("saving")}
                </span>
              )}
              <UnitsToggle units={units} onChange={setUnits} />
            </div>
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
                  <span className="font-semibold text-[hsl(var(--foreground))]">{dimStr}</span>{" "}
                  {geoReady ? u : ""}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Weight className="h-3.5 w-3.5" />
                  <span className="font-semibold text-[hsl(var(--foreground))]">{weightStr}</span>
                </span>
                <span>
                  Area:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">{areaStr}</span>{" "}
                  {geoReady ? `${u}²` : ""}
                </span>
                <span>
                  Volume:{" "}
                  <span className="font-semibold text-[hsl(var(--foreground))]">{volStr}</span>{" "}
                  {geoReady ? `${u}³` : ""}
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
                          <td className="px-3 py-2">
                            {row.verbatim ? (
                              <VerbatimPill field={row.field} text={row.verbatim} />
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <SourcePill source={row.source} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Workflow + qty toolbar (part of the fixed header) */}
          <div className="flex items-center gap-2 border-y border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-2">
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

            <ResetEstimateButton
              orgSlug={orgSlug}
              rfqParam={rfqParam}
              rfqId={rfqId}
              rfqStatus={rfqStatus}
            />

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
        </div>

        {/* Scrollable body — materials/operations/notes scroll under the fixed header */}
        <div className="flex-1 overflow-auto">
          <MaterialsSection
            quantities={qtyNumbers}
            cards={materials}
            onAdd={addMat}
            onPatch={patchMat}
            onDelete={deleteMat}
            onCopy={copyMat}
            onReorder={reorderMats}
          />
          <OperationsSection
            quantities={qtyNumbers}
            operations={operations}
            onAdd={addOp}
            onPatch={patchOp}
            onDelete={deleteOp}
            onCopy={copyOp}
            onReorder={reorderOps}
          />
          <NotesSection external={notesExternal} internal={notesInternal} onChange={changeNote} />

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

/** Verbatim value as a coloured highlight pill. The colour is the field's
 *  identity (field-identity.ts) — the same colour that will mark the field's
 *  region on the PDF drawing. Falls back to neutral for unmapped fields. */
function VerbatimPill({ field, text }: { field: string; text: string }) {
  const c = FIELD_COLORS[field];
  if (!c) {
    return (
      <span className="inline-block rounded px-2 py-0.5 italic text-[hsl(var(--muted-foreground))]">
        {text}
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded px-2 py-0.5 font-medium"
      style={{ backgroundColor: c.fill, color: c.text }}
    >
      {text}
    </span>
  );
}

/** Source type as a plain, light-bg coloured pill (Technical Drawing / CAD Model /
 *  Calculated), matching the reference styling. */
function SourcePill({ source }: { source: SourceType }) {
  const s = SOURCE_STYLES[source];
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: s.fill, color: s.text }}
    >
      {source}
    </span>
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
