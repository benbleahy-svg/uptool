// DXF (2D / sheet-metal) geometry extraction via dxf-parser. Sums entity lengths
// for the laser/cut path, counts closed contours as pierces, and counts entities on
// bend/fold layers. DXF coordinates are assumed to be in millimetres (no unit
// conversion — $INSUNITS is not consulted; sheet-metal DXF is conventionally mm).

import DxfParser, {
  type IArcEntity,
  type ICircleEntity,
  type IEntity,
  type ILineEntity,
  type ILwpolylineEntity,
  type IPoint,
  type IPolylineEntity,
  type ISplineEntity,
} from "dxf-parser";

export interface DxfGeometry {
  cutLengthMm: number;
  pierceCount: number;
  bendCount: number;
}

// Bend/fold layer names across the DACH + English conventions.
const BEND_LAYER_RE = /bend|fold|biegung|kante/i;

function dist(a: IPoint, b: IPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

/** Total length along a vertex list, optionally closing the loop. */
function polylineLength(vertices: IPoint[], closed: boolean): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    len += dist(vertices[i - 1] as IPoint, vertices[i] as IPoint);
  }
  if (closed && vertices.length > 2) {
    len += dist(vertices[vertices.length - 1] as IPoint, vertices[0] as IPoint);
  }
  return len;
}

export function extractDxfGeometry(buffer: Buffer): DxfGeometry {
  const parsed = new DxfParser().parseSync(buffer.toString("utf8"));
  if (!parsed) throw new Error("dxf-parser returned null");

  let cutLengthMm = 0;
  let pierceCount = 0;
  let bendCount = 0;

  for (const entity of parsed.entities as IEntity[]) {
    // A bend/fold-layer entity counts as a bend. (Per spec it still contributes to
    // cut length below — there is no layer-based exclusion.)
    if (BEND_LAYER_RE.test(entity.layer ?? "")) bendCount += 1;

    switch (entity.type) {
      case "LINE": {
        const v = (entity as ILineEntity).vertices;
        if (v && v.length >= 2) cutLengthMm += polylineLength(v, false);
        break;
      }
      case "ARC": {
        const a = entity as IArcEntity;
        const swept = Number.isFinite(a.angleLength)
          ? Math.abs(a.angleLength)
          : Math.abs(a.endAngle - a.startAngle);
        cutLengthMm += a.radius * swept;
        break;
      }
      case "CIRCLE": {
        const c = entity as ICircleEntity;
        cutLengthMm += 2 * Math.PI * c.radius;
        pierceCount += 1; // a full circle is one closed contour
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        const p = entity as ILwpolylineEntity | IPolylineEntity;
        if (p.vertices && p.vertices.length > 0) {
          const closed = p.shape === true;
          cutLengthMm += polylineLength(p.vertices, closed);
          if (closed) pierceCount += 1;
        }
        break;
      }
      case "SPLINE": {
        const s = entity as ISplineEntity;
        const pts = s.fitPoints?.length ? s.fitPoints : (s.controlPoints ?? []);
        if (pts.length >= 2) cutLengthMm += polylineLength(pts, s.closed === true);
        if (s.closed === true) pierceCount += 1;
        break;
      }
      case "INSERT": {
        // Block reference — conservatively one pierce; we don't expand block
        // geometry into the cut path (too fragile without resolving the block).
        pierceCount += 1;
        break;
      }
      default:
        break;
    }
  }

  return { cutLengthMm, pierceCount, bendCount };
}
