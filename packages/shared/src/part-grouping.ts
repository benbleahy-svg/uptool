// Pure helpers for auto-creating parts from ingested RFQ attachments. No DB / no
// framework / no API calls — the Claude pairing (for multi-CAD RFQs) happens in the
// services layer and its parsed result is passed into buildPartGroups() as data.

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

/** Claude's filename pairing for a multi-CAD RFQ. Each part is one CAD + its
 *  drawing PDFs; PDFs Claude couldn't confidently place go in unmatchedPdfs. */
export interface PairingResult {
  parts: Array<{ cad: string; pdfs: string[] }>;
  unmatchedPdfs: string[];
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

const isCad = (filename: string): boolean => attachmentCategory(filename) === "cad";
const isDrawing = (filename: string): boolean => attachmentCategory(filename) === "drawing";

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
 * Whether Claude pairing is worth the API call. With 0 or 1 CAD file there is no
 * ambiguity — a lone CAD owns every PDF — so the fast path handles it. With ≥2 CAD
 * files a PDF could belong to any of them, which is exactly what stem-matching got
 * wrong (model and drawing carry different document numbers), so we ask Claude.
 */
export function needsAiPairing(files: AttachmentRef[]): boolean {
  return files.filter((f) => isCad(f.filename)).length >= 2;
}

function cadGroup(file: AttachmentRef, extraPdfIds: string[] = []): PartGroup {
  return {
    name: nameFromStem(stemOf(file.filename)),
    processType: processTypeForExt(extOf(file.filename)),
    attachmentIds: [file.id, ...extraPdfIds],
  };
}

/**
 * Build parts from ingested attachments.
 *
 * Fast path (`pairing` omitted/null): used for ≤1 CAD, and as the fallback when a
 * Claude pairing call failed.
 *   - 1 CAD: one part, every PDF linked to it.
 *   - 0 CAD: each PDF becomes its own part (a drawing for a manually-added part).
 *   - ≥2 CAD with no pairing (fallback): one part per CAD, PDFs left unlinked.
 *
 * Slow path (`pairing` provided): build from Claude's grouping — one part per CAD
 * with its paired PDFs. `unmatchedPdfs` (and any file Claude omitted) stay unlinked.
 * Defensive: any CAD Claude failed to place still gets its own part, so a CAD is
 * never silently dropped.
 */
export function buildPartGroups(
  files: AttachmentRef[],
  pairing?: PairingResult | null,
): PartGroup[] {
  const cads = files.filter((f) => isCad(f.filename));
  const pdfs = files.filter((f) => isDrawing(f.filename));

  if (!pairing) {
    if (cads.length === 0) {
      return pdfs.map((p) => ({
        name: nameFromStem(stemOf(p.filename)),
        processType: null,
        attachmentIds: [p.id],
      }));
    }
    if (cads.length === 1) {
      // biome-ignore lint/style/noNonNullAssertion: length checked above
      return [cadGroup(cads[0]!, pdfs.map((p) => p.id))];
    }
    // ≥2 CAD, no pairing → fallback: one part per CAD, PDFs unlinked.
    return cads.map((c) => cadGroup(c));
  }

  // Slow path: resolve Claude's filenames back to attachment ids (exact, then
  // case-insensitive). Skip a part whose CAD we can't resolve.
  const byName = new Map(files.map((f) => [f.filename, f.id]));
  const byLower = new Map(files.map((f) => [f.filename.toLowerCase(), f.id]));
  const fileById = new Map(files.map((f) => [f.id, f]));
  const resolve = (fn: string): string | undefined =>
    byName.get(fn) ?? byLower.get(fn.toLowerCase());

  const groups: PartGroup[] = [];
  const usedCadIds = new Set<string>();

  for (const part of pairing.parts) {
    const cadId = resolve(part.cad);
    const cadFile = cadId ? fileById.get(cadId) : undefined;
    if (!cadFile || !isCad(cadFile.filename)) continue;
    const pdfIds = (part.pdfs ?? [])
      .map(resolve)
      .filter((id): id is string => id !== undefined);
    groups.push(cadGroup(cadFile, pdfIds));
    usedCadIds.add(cadFile.id);
  }

  // Safety net: any CAD Claude omitted still gets its own part.
  for (const c of cads) {
    if (!usedCadIds.has(c.id)) groups.push(cadGroup(c));
  }

  return groups;
}

/**
 * Parse Claude's pairing response into a PairingResult. Tolerates ```json fences
 * and surrounding prose by extracting the outermost JSON object. Throws on invalid
 * JSON or shape so the caller can fall back to the fast path.
 */
export function parsePairingResponse(raw: string): PairingResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object in pairing response");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Pairing response is not an object");
  }
  const obj = parsed as { parts?: unknown; unmatched_pdfs?: unknown };
  if (!Array.isArray(obj.parts)) throw new Error("Pairing response missing parts[]");

  const parts = obj.parts.map((p) => {
    if (typeof p !== "object" || p === null) throw new Error("Invalid part entry");
    const { cad, pdfs } = p as { cad?: unknown; pdfs?: unknown };
    if (typeof cad !== "string") throw new Error("Part missing cad filename");
    const pdfList = Array.isArray(pdfs) ? pdfs.filter((x): x is string => typeof x === "string") : [];
    return { cad, pdfs: pdfList };
  });
  const unmatchedPdfs = Array.isArray(obj.unmatched_pdfs)
    ? obj.unmatched_pdfs.filter((x): x is string => typeof x === "string")
    : [];

  return { parts, unmatchedPdfs };
}
