"use client";

// Left pane: the quote PDF preview + centered Print/Download. Presentational —
// the usePDF instance is owned by send-client (so the composer can attach the
// same rendered PDF). Print injects a hidden iframe and calls print().

import { Download, Printer } from "lucide-react";

interface PdfInstance {
  loading: boolean;
  url: string | null;
  error: string | null;
}

interface Props {
  instance: PdfInstance;
  quoteNumber: number;
  downloadName: string;
}

export function QuotePdfPane({ instance, quoteNumber, downloadName }: Props) {
  const ready = !instance.loading && !!instance.url && !instance.error;

  function handlePrint() {
    if (!instance.url) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    frame.src = instance.url;
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
      {instance.error ? (
        <div className="m-auto text-sm text-red-200">Failed to render the quote PDF.</div>
      ) : ready ? (
        <iframe
          src={instance.url ?? undefined}
          title={`Quote ${quoteNumber} preview`}
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
          href={ready ? (instance.url ?? undefined) : undefined}
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
