"use client";

import { Maximize, Scan, SquareArrowOutUpRight } from "lucide-react";
import * as React from "react";
import { type CadApi, CadCanvas } from "./cad-canvas";
import { CadInspectorDialog } from "./cad-inspector-dialog";
import type { FileRef } from "./mocks/mockFiles";

const WHITE: [number, number, number] = [255, 255, 255];

export function CadViewer({ file, onPopout }: { file: FileRef; onPopout: () => void }) {
  const apiRef = React.useRef<CadApi | null>(null);
  const [inspectorOpen, setInspectorOpen] = React.useState(false);

  return (
    <div className="relative h-full w-full bg-white">
      <CadCanvas
        url={file.url}
        background={WHITE}
        onReady={(api) => {
          apiRef.current = api;
        }}
      />

      <div className="absolute left-3 top-3 flex gap-1.5">
        <CornerButton label="Expand to inspector" onClick={() => setInspectorOpen(true)}>
          <Maximize className="h-4 w-4" />
        </CornerButton>
        <CornerButton label="Fit to view" onClick={() => apiRef.current?.fitToView()}>
          <Scan className="h-4 w-4" />
        </CornerButton>
      </div>

      <div className="absolute right-3 top-3">
        <CornerButton label="Open in new tab" onClick={onPopout}>
          <SquareArrowOutUpRight className="h-4 w-4" />
        </CornerButton>
      </div>

      <CadInspectorDialog open={inspectorOpen} onOpenChange={setInspectorOpen} file={file} />
    </div>
  );
}

function CornerButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 bg-white/90 text-gray-500 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-900"
    >
      {children}
    </button>
  );
}
