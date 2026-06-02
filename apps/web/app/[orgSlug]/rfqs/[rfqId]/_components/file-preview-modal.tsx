"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@uptool/ui";
import dynamic from "next/dynamic";
import type { FileRef } from "../estimate/[partId]/mocks/mockFiles";

// Reuse the existing viewers verbatim — no new viewer implementations.
// CAD → the online-3d-viewer inspector (its own "File preview" Dialog).
// PDF → the pdf.js DrawingViewer, dropped into a matching full-screen Dialog.
const CadInspectorDialog = dynamic(
  () => import("../estimate/[partId]/cad-inspector-dialog").then((m) => m.CadInspectorDialog),
  { ssr: false },
);
const DrawingViewer = dynamic(
  () => import("../estimate/[partId]/drawing-viewer").then((m) => m.DrawingViewer),
  { ssr: false },
);

export function FilePreviewModal({
  file,
  kind,
  onClose,
}: {
  file: FileRef;
  kind: "cad" | "pdf";
  onClose: () => void;
}) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  // The CAD inspector is already a self-contained "File preview" Dialog (× + Esc).
  if (kind === "cad") {
    return <CadInspectorDialog open onOpenChange={handleOpenChange} file={file} />;
  }

  // PDF: same full-screen shell as the CAD inspector, with the dark pdf.js toolbar inside.
  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="bottom-2 left-2 right-2 top-2 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-lg bg-white p-0">
        <div className="flex h-11 flex-none items-center border-b border-gray-200 px-4">
          <DialogTitle className="text-sm font-semibold">File preview</DialogTitle>
          <DialogDescription className="sr-only">{file.name}</DialogDescription>
        </div>
        <div className="min-h-0 flex-1">
          <DrawingViewer file={file} onPopout={() => window.open(file.url, "_blank", "noopener")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
