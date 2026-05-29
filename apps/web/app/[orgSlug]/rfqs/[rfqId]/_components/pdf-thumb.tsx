"use client";

import { Document, Page, pdfjs } from "react-pdf";

// Same self-hosted worker as the drawing viewer (pdfjs-dist 3.11, same-origin).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

/** First-page PDF thumbnail, sized to a fixed height (text/annotation layers off). */
export function PdfThumb({ url, height }: { url: string; height: number }) {
  return (
    <Document file={url} loading={null} error={null} className="flex items-center justify-center">
      <Page pageNumber={1} height={height} renderTextLayer={false} renderAnnotationLayer={false} />
    </Document>
  );
}
