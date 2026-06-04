"use client";

import { File as FileIcon } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import { CadCanvas } from "./cad-canvas";
import { getMockFiles } from "./mocks/mockFiles";
import { getMockPart } from "./mocks/mockPart";
import { buildHighlights } from "./pdf-highlight-overlay";

const THUMB_BG: [number, number, number] = [243, 244, 246];

const DrawingViewer = dynamic(() => import("./drawing-viewer").then((m) => m.DrawingViewer), {
  ssr: false,
  loading: () => <ViewerLoading label="Loading drawing…" />,
});
const CadViewer = dynamic(() => import("./cad-viewer").then((m) => m.CadViewer), {
  ssr: false,
  loading: () => <ViewerLoading label="Loading 3D model…" />,
});

type Mode = "drawing" | "cad";

export function FileViewerPane({ partId }: { partId: string }) {
  const files = getMockFiles(partId);
  // Source-highlight boxes derived from the part's extracted-field regions, coloured
  // via the field colour-identity map. Empty until extraction returns coordinates
  // (see ADR 0011), so the overlay currently paints nothing.
  const highlights = buildHighlights(getMockPart(partId)?.sourceRegions);
  const drawing = files.drawings[0];
  const cad = files.cad[0];
  const hasDrawing = !!drawing;
  const hasCad = !!cad;

  const [mode, setMode] = React.useState<Mode>(hasDrawing ? "drawing" : "cad");

  // Keep mode valid if the part (and thus available files) changes.
  React.useEffect(() => {
    if (mode === "drawing" && !hasDrawing) setMode("cad");
    else if (mode === "cad" && !hasCad) setMode("drawing");
  }, [mode, hasDrawing, hasCad]);

  const popout = React.useCallback(() => {
    window.open(window.location.href, "_blank", "noopener");
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-zinc-200">
      {mode === "drawing" && drawing ? (
        <DrawingViewer file={drawing} onPopout={popout} highlights={highlights} />
      ) : cad ? (
        <CadViewer file={cad} onPopout={popout} />
      ) : (
        <ViewerLoading label="No files for this part." />
      )}

      {hasDrawing && hasCad && cad && (
        <button
          type="button"
          onClick={() => setMode((m) => (m === "drawing" ? "cad" : "drawing"))}
          aria-label={mode === "drawing" ? "Switch to CAD model" : "Switch to drawing"}
          className="absolute bottom-4 right-4 z-10 h-20 w-20 overflow-hidden rounded-xl border border-gray-300 bg-white shadow-md transition-shadow hover:shadow-lg"
        >
          {mode === "drawing" ? (
            <CadCanvas url={cad.url} interactive={false} background={THUMB_BG} />
          ) : (
            <span className="grid h-full w-full place-items-center text-gray-500">
              <FileIcon className="h-8 w-8" />
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function ViewerLoading({ label }: { label: string }) {
  return <div className="grid h-full w-full place-items-center text-sm text-zinc-500">{label}</div>;
}
