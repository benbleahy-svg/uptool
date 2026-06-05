export const MANUFACTURING_EXTENSIONS = new Set([
  ".pdf",
  ".dxf",
  ".dwg",
  ".step",
  ".stp",
  ".iges",
  ".igs",
  ".stl",
  ".3mf",
]);

export function isManufacturingFile(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MANUFACTURING_EXTENSIONS.has(ext);
}

const CAD_EXTENSIONS = new Set([
  ".step",
  ".stp",
  ".iges",
  ".igs",
  ".stl",
  ".3mf",
  ".dxf",
  ".dwg",
  ".x_t",
  ".sldprt",
  ".sldasm",
]);

/** Classify an attachment by extension for the RFQ attachment tabs. */
export function attachmentCategory(filename: string): "cad" | "drawing" | "other" {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (CAD_EXTENSIONS.has(ext)) return "cad";
  if (ext === ".pdf") return "drawing";
  return "other";
}
