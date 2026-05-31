"use client";

// Left pane: the server-rendered quote PDF preview + centered Print/Download.
// Presentational — the object URL of the server PDF is owned by send-client, so
// the preview, Download, Print, and the email attachment all share one render.

import { Download, Printer } from "lucide-react";

interface Props {
  url: string | null;
  loading: boolean;
  error: boolean;
  quoteLabel: string;
  downloadName: string;
}

export function QuotePdfPane({ url, loading, error, quoteLabel, downloadName }: Props) {
  const ready = !loading && !error && !!url;

  function handlePrint() {
    if (!url) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    frame.src = url;
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return;
      win.addEventListener("afterprint", () => frame.remove());
      win.focus();
      win.print();
    };
    document.body.appendChild(frame);
  }

  return (
    <div className="flex h-full flex-col items-center overflow-auto bg-[#3f4654] p-6">
      {error ? (
        <div className="m-auto text-sm text-red-200">Failed to render the quote PDF.</div>
      ) : ready ? (
        <iframe
          src={url ?? undefined}
          title={`Quote ${quoteLabel} preview`}
          className="w-full max-w-[820px] flex-1 rounded-sm bg-white shadow-2xl"
        />
      ) : (
        <div className="m-auto text-sm text-gray-300">Generating quote…</div>
      )}

      {/* Centered Print + Download under the document */}
      <div className="mt-4 flex shrink-0 items-center justify-center gap-3">
        <button
          type="button"
          onClick={handlePrint}
          disabled={!ready}
          aria-label="Print quote"
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
