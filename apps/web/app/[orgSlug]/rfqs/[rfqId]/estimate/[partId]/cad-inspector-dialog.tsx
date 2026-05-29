"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle, cn } from "@uptool/ui";
import {
  Box,
  Camera,
  Eye,
  EyeOff,
  File as FileIcon,
  Maximize2,
  Moon,
  Move3d,
  RotateCw,
  Ruler,
  Scissors,
  Settings,
  Sun,
} from "lucide-react";
import * as React from "react";
import { type CadApi, CadCanvas, type CadStats } from "./cad-canvas";
import type { FileRef } from "./mocks/mockFiles";

const MM_PER_CM = 10;
const fmt = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileRef;
}

export function CadInspectorDialog({ open, onOpenChange, file }: Props) {
  const apiRef = React.useRef<CadApi | null>(null);
  const [stats, setStats] = React.useState<CadStats | null>(null);
  const [dark, setDark] = React.useState(false);
  const [hidden, setHidden] = React.useState<Record<number, boolean>>({});
  const [calc, setCalc] = React.useState<{ volumeCm3: number; surfaceCm2: number } | null>(null);

  const meshes = stats?.meshes.length ? stats.meshes : [file.name];

  function calculate() {
    const d = stats?.dims;
    if (!d) return;
    setCalc({
      volumeCm3: (d.x * d.y * d.z) / 1000,
      surfaceCm2: (2 * (d.x * d.y + d.y * d.z + d.z * d.x)) / 100,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "bottom-2 left-2 right-2 top-2 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-lg p-0",
          dark ? "bg-zinc-900 text-zinc-100" : "bg-white text-gray-900",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex h-11 flex-none items-center border-b px-4",
            dark ? "border-zinc-700" : "border-gray-200",
          )}
        >
          <DialogTitle className="text-sm font-semibold">File preview</DialogTitle>
          <DialogDescription className="sr-only">3D CAD model inspector</DialogDescription>
        </div>

        {/* Toolbar */}
        <div
          className={cn(
            "flex h-11 flex-none items-center gap-1 border-b px-2",
            dark ? "border-zinc-700" : "border-gray-200",
          )}
        >
          <InspectorButton
            dark={dark}
            label="Fit to view"
            onClick={() => apiRef.current?.fitToView()}
          >
            <Maximize2 className="h-4 w-4" />
          </InspectorButton>
          <InspectorButton dark={dark} label="Orientation">
            <Move3d className="h-4 w-4" />
          </InspectorButton>
          <InspectorButton dark={dark} label="Rotate">
            <RotateCw className="h-4 w-4" />
          </InspectorButton>
          <Divider dark={dark} />
          <InspectorButton dark={dark} label="Section">
            <Scissors className="h-4 w-4" />
          </InspectorButton>
          <InspectorButton dark={dark} label="Measure">
            <Ruler className="h-4 w-4" />
          </InspectorButton>
          <InspectorButton dark={dark} label="Screenshot">
            <Camera className="h-4 w-4" />
          </InspectorButton>
          <div className="ml-auto" />
          <InspectorButton dark={dark} label="Toggle theme" onClick={() => setDark((d) => !d)}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </InspectorButton>
        </div>

        {/* Body: meshes | canvas | details */}
        <div className="flex min-h-0 flex-1">
          {/* Left rail */}
          <div
            className={cn(
              "flex w-56 flex-none border-r",
              dark ? "border-zinc-700" : "border-gray-200",
            )}
          >
            <div
              className={cn(
                "flex w-9 flex-none flex-col items-center gap-3 border-r py-3 text-gray-400",
                dark ? "border-zinc-700" : "border-gray-200",
              )}
            >
              <FileIcon className="h-4 w-4" />
              <Box className="h-4 w-4" />
              <Settings className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 p-2">
              <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold">
                Meshes
                <Maximize2 className="h-3.5 w-3.5 text-gray-400" />
              </div>
              {meshes.map((name, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: mesh order is stable
                  key={i}
                  className={cn(
                    "group flex items-center gap-2 rounded px-1.5 py-1 text-xs",
                    dark ? "hover:bg-zinc-800" : "hover:bg-gray-100",
                  )}
                >
                  <span className="truncate">{name}</span>
                  <button
                    type="button"
                    aria-label="Fit mesh"
                    onClick={() => apiRef.current?.fitToView()}
                    className="ml-auto text-gray-400 hover:text-current"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Toggle visibility"
                    onClick={() => setHidden((h) => ({ ...h, [i]: !h[i] }))}
                    className="text-gray-400 hover:text-current"
                  >
                    {hidden[i] ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="relative min-w-0 flex-1">
            {open && (
              <CadCanvas
                url={file.url}
                background={dark ? [24, 24, 27] : [255, 255, 255]}
                onReady={(api) => {
                  apiRef.current = api;
                }}
                onLoaded={() => setStats(apiRef.current?.getStats() ?? null)}
              />
            )}
          </div>

          {/* Details */}
          <div
            className={cn(
              "w-64 flex-none border-l p-4 text-xs",
              dark ? "border-zinc-700" : "border-gray-200",
            )}
          >
            <div className="mb-2 text-sm font-semibold">Details</div>
            <Detail label="Vertices" value={stats ? stats.vertices.toLocaleString("en-US") : "…"} />
            <Detail
              label="Triangles"
              value={stats ? stats.triangles.toLocaleString("en-US") : "…"}
            />
            <Detail label="Dimensions" value="mm / cm" muted />
            <Detail label="X" value={dimText(stats?.dims?.x)} />
            <Detail label="Y" value={dimText(stats?.dims?.y)} />
            <Detail label="Z" value={dimText(stats?.dims?.z)} />
            <Detail
              label="Volume"
              value={calc ? `${fmt(calc.volumeCm3)} cm³` : <CalcLink onClick={calculate} />}
            />
            <Detail
              label="Surface"
              value={calc ? `${fmt(calc.surfaceCm2)} cm²` : <CalcLink onClick={calculate} />}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function dimText(mm: number | undefined): string {
  if (mm == null) return "…";
  return `${fmt(mm)} / ${fmt(mm / MM_PER_CM)}`;
}

function Detail({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-gray-400">{label}:</span>
      <span className={cn("text-right tabular-nums", muted && "text-gray-400")}>{value}</span>
    </div>
  );
}

function CalcLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[hsl(var(--primary))] hover:underline">
      Calculate…
    </button>
  );
}

function Divider({ dark }: { dark: boolean }) {
  return <span className={cn("mx-1 h-5 w-px", dark ? "bg-zinc-700" : "bg-gray-200")} />;
}

function InspectorButton({
  label,
  onClick,
  dark,
  children,
}: {
  label: string;
  onClick?: () => void;
  dark: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md text-gray-500 transition-colors",
        dark ? "hover:bg-zinc-800 hover:text-zinc-100" : "hover:bg-gray-100 hover:text-gray-900",
      )}
    >
      {children}
    </button>
  );
}
