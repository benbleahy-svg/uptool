// Pure helpers for auto-creating parts from ingested RFQ attachments. No DB / no
// framework deps so they can be unit-tested in isolation. The services layer
// queries attachment rows and feeds them to groupAttachmentsIntoParts().

import { attachmentCategory } from "./constants";

export interface AttachmentRef {
  id: string;
  filename: string;
}

export interface PartGroup {
  /** Display name = part_number (title-cased stem of the primary file). */
  name: string;
  /** Derived from the primary file extension; null for a lone PDF. */
  processType: string | null;
  /** Attachment ids belonging to this part (primary CAD first, then drawings). */
  attachmentIds: string[];
}

/** Extension including the dot, lower-cased (e.g. ".step"). */
function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/** Filename without its extension, original case preserved (for naming). */
function stemOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? filename : filename.slice(0, dot);
}

/**
 * Title-case a filename stem for display: separators (_ and -) become spaces,
 * each word's first letter is upper-cased, the rest left as-is so embedded caps
 * survive ("5216488_VentPlate" → "5216488 VentPlate", "bracket_rev_a" → "Bracket Rev A").
 */
export function nameFromStem(stem: string): string {
  return stem
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Normalised matching key for pairing a drawing PDF with its CAD file: lower-cased,
 * separators removed, then common drawing/revision suffixes stripped from the end
 * (_rev_a, _reva, _v1, _drawing, _print …). "5216488_VentPlate" and
 * "5216488_VentPlate" match; "bracket_rev_a" and "bracket_drawing" both reduce to
 * "bracket".
 */
export function normalizeStem(stem: string): string {
  let s = stem.toLowerCase().replace(/[\s_-]+/g, "");
  // Strip trailing suffixes repeatedly (handles e.g. "..._rev_a_drawing").
  let changed = true;
  while (changed) {
    const next = s.replace(/(rev[a-z0-9]*|v\d+|drawing|print)$/, "");
    changed = next !== s && next.length > 0;
    s = next.length > 0 ? next : s;
  }
  return s;
}

/** process_type from the primary file extension. 2D formats → Sheet Metal,
 *  solid/3D formats → CNC Milling (refined later by geometry extraction). */
export function processTypeForExt(ext: string): string | null {
  switch (ext) {
    case ".dxf":
    case ".dwg":
      return "Sheet Metal";
    case ".step":
    case ".stp":
    case ".iges":
    case ".igs":
    case ".stl":
    case ".3mf":
      return "CNC Milling";
    default:
      return null;
  }
}

/**
 * Group ingested attachments into parts by filename stem.
 *  - Each CAD file (.step/.stp/.iges/.dxf/.dwg/…) becomes a part (primary file).
 *  - A drawing PDF attaches to the CAD part with the same normalised stem; a PDF
 *    with no CAD match becomes its own part (process_type null).
 *  - Order: CAD parts in file order, then any lone-PDF parts.
 */
export function groupAttachmentsIntoParts(files: AttachmentRef[]): PartGroup[] {
  const groups: PartGroup[] = [];
  const stemToIndex = new Map<string, number>();

  // Pass 1: one group per CAD file.
  for (const f of files) {
    if (attachmentCategory(f.filename) !== "cad") continue;
    const stem = stemOf(f.filename);
    const group: PartGroup = {
      name: nameFromStem(stem),
      processType: processTypeForExt(extOf(f.filename)),
      attachmentIds: [f.id],
    };
    const index = groups.push(group) - 1;
    const key = normalizeStem(stem);
    if (!stemToIndex.has(key)) stemToIndex.set(key, index);
  }

  // Pass 2: attach drawing PDFs to a matching CAD part, else make a lone part.
  for (const f of files) {
    if (attachmentCategory(f.filename) !== "drawing") continue;
    const stem = stemOf(f.filename);
    const match = stemToIndex.get(normalizeStem(stem));
    const matchedGroup = match !== undefined ? groups[match] : undefined;
    if (matchedGroup) {
      matchedGroup.attachmentIds.push(f.id);
    } else {
      groups.push({ name: nameFromStem(stem), processType: null, attachmentIds: [f.id] });
    }
  }

  return groups;
}
