"use client";

// Left pane: the server-rendered quote PDF, displayed with pdf.js (react-pdf) on
// a canvas — NOT a <iframe src="blob:">, which Safari refuses to render. The
// canvas path is identical across Chrome/Safari/Firefox. The Blob is passed
// straight to react-pdf (read locally, no blob fetch → no CSP issue); the object
// URL is reused for Download so everything still derives from one /api/quote-pdf
// render. Print opens a top-level window (the only path Safari prints a blob) and
// closes it automatically once the print dialog returns.

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

import { Download, Printer } from "lucide-react";
import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Self-hosted worker (pdfjs-dist 3.11, matching react-pdf 7) — same-origin, CSP-safe.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

interface Props {
  blob: Blob | null;
  url: string | null;
  loading: boolean;
  error: boolean;
  quoteLabel: string;
  downloadName: string;
}

export function QuotePdfPane({ blob, url, loading, error, quoteLabel, downloadName }: Props) {
  const [numPages, setNumPages] = React.useState(0);
  const [width, setWidth] = React.useState(0);
  const [renderError, setRenderError] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Fit pages to the pane width.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const failed = error || renderError;
  const ready = !loading && !failed && !!blob;
  const printable = ready && numPages > 0 && !!blob;

  // Print the real PDF in a top-level window (Safari only prints a blob this way,
  // not in an iframe), then close that window automatically. A dedicated object
  // URL is created for the print window and revoked once done.
  function handlePrint() {
    if (!blob) return;
    const printUrl = URL.createObjectURL(blob);
    const win = window.open(printUrl, "_blank");
    if (!win) {
      URL.revokeObjectURL(printUrl);
      return;
    }
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      window.removeEventListener("focus", cleanup);
      try {
        if (!win.closed) win.close();
      } catch {
        /* cross-window access can throw after close */
      }
      URL.revokeObjectURL(printUrl);
    };
    win.addEventListener("load", () => {
      win.focus();
      // afterprint fires whether the user prints or cancels.
      win.addEventListener("afterprint", cleanup, { once: true });
      win.print();
      // Fallback: if afterprint doesn't fire (some PDF viewers), close when the
      // user returns to this tab. Attached after print() to avoid the open-time
      // focus churn closing it prematurely.
      window.addEventListener("focus", cleanup);
    });
    // Last-resort safety net so a stray tab never lingers.
    window.setTimeout(cleanup, 60_000);
  }

  return (
    <div className="flex h-full flex-col bg-[#3f4654]">
      {/* Scrollable document area */}
      <div ref={scrollRef} className="flex flex-1 flex-col items-center overflow-auto p-6">
        {failed ? (
          <div className="m-auto text-sm text-red-200">Failed to render the quote PDF.</div>
        ) : ready ? (
          <Document
            file={blob}
            onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
            onLoadError={() => setRenderError(true)}
            loading={<div className="m-auto text-sm text-gray-300">Generating quote…</div>}
            error={<div className="m-auto text-sm text-red-200">Failed to render the quote PDF.</div>}
            className="flex w-full max-w-[820px] flex-col items-center gap-3"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed page order
                key={i}
                pageNumber={i + 1}
                width={Math.min(width - 48, 820)}
                className="shadow-2xl"
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            ))}
          </Document>
        ) : (
          <div className="m-auto text-sm text-gray-300">Generating quote…</div>
        )}
      </div>

      {/* Pinned action bar — always visible while scrolling the pages */}
      <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 py-3">
        <button
          type="button"
          onClick={handlePrint}
          disabled={!printable}
          aria-label="Print quote"
          title={`Print quote ${quoteLabel}`}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
        </button>
        <a
          href={ready ? (url ?? undefined) : undefined}
          download={downloadName}
          aria-label="Download quote"
          aria-disabled={!ready}
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow transition-colors hover:bg-gray-100 ${
            ready ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
