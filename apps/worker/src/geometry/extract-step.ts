// STEP / IGES geometry extraction in Node via occt-import-js (WASM, no WebGL).
// ReadStepFile/ReadIgesFile triangulate the solid; bbox, volume (signed-tetrahedra
// / divergence theorem) and surface area are computed from the mesh vertex arrays.
// STEP/IGES are in millimetres by convention, so the numbers are already mm.

import occtimportjs from "occt-import-js";

export interface StepGeometry {
  bboxXMm: number;
  bboxYMm: number;
  bboxZMm: number;
  volumeMm3: number;
  surfaceAreaMm2: number;
  /** bend_count from a solid is non-trivial (dihedral-edge analysis); 0 is an
   *  accepted fallback per ADR — STEP files rarely drive sheet-metal bend pricing. */
  bendCount: number;
}

// occt-import-js ships no types. ReadStepFile/ReadIgesFile return triangulated
// meshes: positions is a flat [x,y,z,x,y,z,…] array, index a flat triangle list.
interface OcctMesh {
  attributes?: { position?: { array?: number[] } };
  index?: { array?: number[] };
}
interface OcctResult {
  success: boolean;
  meshes?: OcctMesh[];
}
interface OcctModule {
  ReadStepFile(buf: Uint8Array, params: unknown): OcctResult;
  ReadIgesFile(buf: Uint8Array, params: unknown): OcctResult;
}

// occt is a WASM module initialised once (async) and reused across jobs.
let occtPromise: Promise<OcctModule> | null = null;
function getOcct(): Promise<OcctModule> {
  if (!occtPromise) {
    occtPromise = (occtimportjs as unknown as () => Promise<OcctModule>)();
  }
  return occtPromise;
}

const isIges = (ext: string): boolean => ext === ".iges" || ext === ".igs";

export async function extractStepGeometry(buffer: Buffer, ext = ".step"): Promise<StepGeometry> {
  const occt = await getOcct();
  const bytes = new Uint8Array(buffer);
  const result = isIges(ext) ? occt.ReadIgesFile(bytes, null) : occt.ReadStepFile(bytes, null);
  if (!result.success) throw new Error("occt-import-js failed to read the file");

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let volume = 0;
  let surfaceArea = 0;

  for (const mesh of result.meshes ?? []) {
    const pos = mesh.attributes?.position?.array;
    if (!pos || pos.length === 0) continue;

    for (let i = 0; i + 2 < pos.length; i += 3) {
      const x = pos[i] as number;
      const y = pos[i + 1] as number;
      const z = pos[i + 2] as number;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const idx = mesh.index?.array;
    if (!idx) continue;
    const vert = (k: number): [number, number, number] => [
      pos[k * 3] as number,
      pos[k * 3 + 1] as number,
      pos[k * 3 + 2] as number,
    ];
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const v0 = vert(idx[i] as number);
      const v1 = vert(idx[i + 1] as number);
      const v2 = vert(idx[i + 2] as number);

      // Signed tetrahedron volume: v0 · (v1 × v2) / 6.
      const cx = v1[1] * v2[2] - v1[2] * v2[1];
      const cy = v1[2] * v2[0] - v1[0] * v2[2];
      const cz = v1[0] * v2[1] - v1[1] * v2[0];
      volume += (v0[0] * cx + v0[1] * cy + v0[2] * cz) / 6;

      // Triangle area: 0.5 · ||(v1-v0) × (v2-v0)||.
      const e1x = v1[0] - v0[0];
      const e1y = v1[1] - v0[1];
      const e1z = v1[2] - v0[2];
      const e2x = v2[0] - v0[0];
      const e2y = v2[1] - v0[1];
      const e2z = v2[2] - v0[2];
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      surfaceArea += 0.5 * Math.hypot(nx, ny, nz);
    }
  }

  const hasGeometry = Number.isFinite(minX);
  return {
    bboxXMm: hasGeometry ? maxX - minX : 0,
    bboxYMm: hasGeometry ? maxY - minY : 0,
    bboxZMm: hasGeometry ? maxZ - minZ : 0,
    volumeMm3: Math.abs(volume),
    surfaceAreaMm2: surfaceArea,
    bendCount: 0,
  };
}
