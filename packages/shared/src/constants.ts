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
