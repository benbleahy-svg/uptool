"use client";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import { Dialog, DialogContent, DialogDescription, DialogTitle, cn } from "@uptool/ui";
import {
  CloudUpload,
  Download,
  Maximize,
  Minus,
  MoveHorizontal,
  PenLine,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  SquareArrowOutUpRight,
  Undo2,
} from "lucide-react";
import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { FileRef } from "./mocks/mockFiles";

// Self-hosted worker (pdfjs-dist 3.11, matching react-pdf 7) — same-origin, CSP-safe.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const MIN_ZOOM = 10;
const MAX_ZOOM = 400;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function DrawingViewer({ file, onPopout }: { file: FileRef; onPopout: () => void }) {
  const [numPages, setNumPages] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const [zoom, setZoom] = React.useState(80);
  const [zoomInput, setZoomInput] = React.useState("80");
  const [rotation, setRotation] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pageDims = React.useRef({ w: 0, h: 0 });
  const autoOriented = React.useRef(false);
  const printFrameRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => setPageInput(String(page)), [page]);
  React.useEffect(() => setZoomInput(String(zoom)), [zoom]);

  function commitPage() {
    const n = Number.parseInt(pageInput, 10);
    if (Number.isFinite(n)) setPage(Math.min(Math.max(n, 1), numPages || 1));
    else setPageInput(String(page));
  }

  function commitZoom() {
    const n = Number.parseInt(zoomInput, 10);
    if (Number.isFinite(n)) setZoom(clampZoom(n));
    else setZoomInput(String(zoom));
  }

  // Effective page width depends on rotation (landscape swaps w/h).
  function effectiveWidth() {
    return rotation % 180 === 0 ? pageDims.current.w : pageDims.current.h;
  }

  function fitToWidth() {
    const el = containerRef.current;
    const w = effectiveWidth();
    if (!el || !w) return;
    setZoom(clampZoom(Math.round(((el.clientWidth - 48) / w) * 100)));
  }

  function onPageLoad(p: {
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
  }) {
    pageDims.current = { w: p.originalWidth, h: p.originalHeight };
    // Auto-orient drawings to landscape on first load. Uses the effective rendered
    // size so it covers both a portrait media-box and an embedded /Rotate.
    if (!autoOriented.current) {
      autoOriented.current = true;
      if (p.height > p.width) setRotation(90);
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.click();
  }

  function print() {
    let frame = printFrameRef.current;
    if (!frame) {
      frame = document.createElement("iframe");
      frame.style.display = "none";
      document.body.appendChild(frame);
      printFrameRef.current = frame;
    }
    frame.src = file.url;
    frame.onload = () => frame?.contentWindow?.print();
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-200">
      <div className="flex h-11 flex-none items-center gap-1.5 bg-zinc-700 px-2 text-zinc-200">
        <button
          type="button"
          aria-label="Full view"
          onClick={() => setFullscreen(true)}
          className="grid h-8 w-8 flex-none place-items-center rounded-md bg-white text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          <Maximize className="h-4 w-4" />
        </button>
        <span className="max-w-[210px] truncate text-sm text-zinc-100">{file.name}</span>

        <div className="ml-1 flex items-center gap-1 text-sm">
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={commitPage}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label="Page number"
            className="w-7 rounded bg-black/30 px-1 py-0.5 text-center text-zinc-100 outline-none focus:ring-1 focus:ring-white/40"
          />
          <span className="text-zinc-400">/ {numPages || 1}</span>
        </div>

        <Divider />
        <DarkButton label="Zoom out" onClick={() => setZoom((z) => clampZoom(z - 10))}>
          <Minus className="h-4 w-4" />
        </DarkButton>
        <div className="flex items-center rounded bg-black/30 px-1.5 py-0.5 text-sm text-zinc-100">
          <input
            value={zoomInput}
            onChange={(e) => setZoomInput(e.target.value)}
            onBlur={commitZoom}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label="Zoom percent"
            className="w-7 bg-transparent text-right tabular-nums outline-none"
          />
          <span>%</span>
        </div>
        <DarkButton label="Zoom in" onClick={() => setZoom((z) => clampZoom(z + 10))}>
          <Plus className="h-4 w-4" />
        </DarkButton>

        <Divider />
        <DarkButton label="Fit to width" onClick={fitToWidth}>
          <MoveHorizontal className="h-4 w-4" />
        </DarkButton>
        <DarkButton label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}>
          <RotateCw className="h-4 w-4" />
        </DarkButton>
        <DarkButton label="Annotate" onClick={() => console.log("annotate (stub)")}>
          <PenLine className="h-4 w-4" />
        </DarkButton>

        <Divider />
        <DarkButton label="Undo" onClick={() => console.log("undo (stub)")}>
          <Undo2 className="h-4 w-4" />
        </DarkButton>
        <DarkButton label="Redo" onClick={() => console.log("redo (stub)")}>
          <Redo2 className="h-4 w-4" />
        </DarkButton>

        <div className="ml-auto flex items-center gap-1.5">
          <DarkButton label="Cloud sync" onClick={() => console.log("sync (stub)")}>
            <CloudUpload className="h-4 w-4" />
          </DarkButton>
          <DarkButton label="Download" onClick={download}>
            <Download className="h-4 w-4" />
          </DarkButton>
          <DarkButton label="Print" onClick={print}>
            <Printer className="h-4 w-4" />
          </DarkButton>
          <button
            type="button"
            aria-label="Open in new tab"
            onClick={onPopout}
            className="grid h-8 w-8 flex-none place-items-center rounded-md bg-white text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            <SquareArrowOutUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-zinc-300 p-6">
        <div className="flex min-h-full justify-center">
          <Document
            file={file.url}
            onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
            loading={<ViewerMessage>Loading drawing…</ViewerMessage>}
            error={<ViewerMessage>Couldn’t load this drawing.</ViewerMessage>}
            noData={<ViewerMessage>No drawing file.</ViewerMessage>}
          >
            <Page
              pageNumber={page}
              scale={zoom / 100}
              rotate={rotation}
              onLoadSuccess={onPageLoad}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>

      <DrawingFullscreen
        file={file}
        page={page}
        rotation={rotation}
        open={fullscreen}
        onOpenChange={setFullscreen}
      />
    </div>
  );
}

function DrawingFullscreen({
  file,
  page,
  rotation,
  open,
  onOpenChange,
}: {
  file: FileRef;
  page: number;
  rotation: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-2 left-2 right-2 top-2 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-lg bg-white p-0">
        <div className="flex h-11 flex-none items-center border-b border-gray-200 px-4">
          <DialogTitle className="text-sm font-semibold">File preview</DialogTitle>
          <DialogDescription className="sr-only">Full drawing preview</DialogDescription>
        </div>
        <div ref={ref} className="flex-1 overflow-auto bg-zinc-300 p-6">
          {open && width > 0 && (
            <div className="flex min-h-full justify-center">
              <Document
                file={file.url}
                loading={<ViewerMessage>Loading drawing…</ViewerMessage>}
                error={<ViewerMessage>Couldn’t load this drawing.</ViewerMessage>}
              >
                <Page
                  pageNumber={page}
                  width={Math.max(width - 48, 200)}
                  rotate={rotation}
                  className="shadow-lg"
                />
              </Document>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px flex-none bg-zinc-600" />;
}

function DarkButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 flex-none place-items-center rounded text-zinc-300 transition-colors hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ViewerMessage({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center text-sm text-zinc-500">{children}</div>;
}
