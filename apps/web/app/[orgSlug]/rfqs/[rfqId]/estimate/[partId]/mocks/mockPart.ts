// Stub data for the per-part estimate / quoting page.
// Everything here is placeholder until the real estimate service lands in a
// later prompt. Values are lifted from the design screenshots in `assets/`.

export interface Part {
  id: string;
  partNumber: string;
  revision: string;
  description: string;
  descriptionVerbatim: string;
  material: string;
  materialVerbatim: string;
  finish: string;
  finishVerbatim: string;
  /** Geometry is stored in inches (the base unit); the page converts to mm. */
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
  weightLb: number;
  surfaceAreaIn2: number;
  volumeIn3: number;
  /** Source badge shown in the AI extraction table. */
  source: string;
  defaultWorkflowId: string;
  quantities: number[];
}

export interface WorkflowOption {
  id: string;
  /** Process name; the literal word "Workflow" is appended in the UI. */
  name: string;
}

export interface CompletedEstimate {
  id: string;
  partNumber: string;
  partRevision: string;
  company: string;
  contact: string;
  lastUpdated: string;
  /** Numeric key for default (descending) sort. */
  lastUpdatedAt: number;
  quantities: number[];
}

export const WORKFLOW_OPTIONS: WorkflowOption[] = [
  { id: "sheet-metal", name: "Sheet Metal" },
  { id: "cnc-milling", name: "CNC Milling" },
];

export interface RfqPartRef {
  id: string;
  partNumber: string;
}

/** Stub ordered part list for the footer part nav when real RFQ parts are absent. */
export const MOCK_RFQ_PARTS: RfqPartRef[] = [
  { id: "p1", partNumber: "5216488" },
  { id: "p2", partNumber: "MB-2207" },
  { id: "p3", partNumber: "PEAT Motor Stand" },
];

export const COMPLETED_ESTIMATES: CompletedEstimate[] = [
  {
    id: "est-1",
    partNumber: "PEAT Motor Stand",
    partRevision: "",
    company: "Tesla",
    contact: "Alex Huckstepp",
    lastUpdated: "Feb 25, 10:56 AM",
    lastUpdatedAt: 20260225_1056,
    quantities: [1, 10, 100],
  },
  {
    id: "est-2",
    partNumber: "PEAT Motor Stand",
    partRevision: "",
    company: "Tesla",
    contact: "Alex Huckstepp",
    lastUpdated: "Feb 23, 9:46 PM",
    lastUpdatedAt: 20260223_2146,
    quantities: [1, 10, 100],
  },
  {
    id: "est-3",
    partNumber: "PEAT Motor Stand",
    partRevision: "",
    company: "Tesla",
    contact: "Alex Huckstepp",
    lastUpdated: "Feb 13, 9:10 AM",
    lastUpdatedAt: 20260213_0910,
    quantities: [1, 10, 100],
  },
];

const SOURCE = "Technical Drawing / CAD";

const BASE_PLATE: Part = {
  id: "p1",
  partNumber: "5216488",
  revision: "A",
  description: "BASE PLATE, VENT PLATE - PUB",
  descriptionVerbatim: "BASE PLATE, VENT PLATE - PUB",
  material: "Alloy Steel A36",
  materialVerbatim: "A36 STEEL",
  finish: "Anodize",
  finishVerbatim: "AS MACHINED, ANODIZE, MIL-A-8625, TYPE II, CLASS 1, CLEAR",
  lengthIn: 7.09,
  widthIn: 4.17,
  thicknessIn: 0.12,
  weightLb: 0.82,
  surfaceAreaIn2: 55.45,
  volumeIn3: 2.9,
  source: SOURCE,
  defaultWorkflowId: "sheet-metal",
  quantities: [1, 10, 100],
};

const MOCK_PARTS: Record<string, Part> = {
  p1: BASE_PLATE,
  p2: {
    id: "p2",
    partNumber: "MB-2207",
    revision: "B",
    description: "MOUNTING BRACKET, COLLAR MOUNTING BRACKET - PUB",
    descriptionVerbatim: "MOUNTING BRACKET, COLLAR MOUNTING BRACKET - PUB",
    material: "Aluminum 6061 T6 / T6511 (sheet / bar)",
    materialVerbatim: "6061-T6",
    finish: "Anodize",
    finishVerbatim: "ANODIZE, MIL-A-8625, TYPE II, CLASS 1, CLEAR",
    lengthIn: 2.76,
    widthIn: 2.17,
    thicknessIn: 1.58,
    weightLb: 0.17,
    surfaceAreaIn2: 24.15,
    volumeIn3: 1.71,
    source: SOURCE,
    defaultWorkflowId: "sheet-metal",
    quantities: [1, 10, 100],
  },
  p3: {
    id: "p3",
    partNumber: "PEAT Motor Stand",
    revision: "",
    description: "PEAT Motor Stand",
    descriptionVerbatim: "PEAT MOTOR STAND",
    material: "Aluminum 6061 T6 / T6511 (sheet / bar)",
    materialVerbatim: "6061-T6",
    finish: "Anodize",
    finishVerbatim: "ANODIZE, MIL-A-8625, TYPE II, CLASS 1, CLEAR",
    lengthIn: 18.24,
    widthIn: 8.17,
    thicknessIn: 4.33,
    weightLb: 18.98,
    surfaceAreaIn2: 409.85,
    volumeIn3: 194.65,
    source: SOURCE,
    defaultWorkflowId: "cnc-milling",
    quantities: [1, 10, 100],
  },
};

/**
 * Look up the mock part for a given id. Demo ids (`p1`/`p2`/`p3`) return their
 * seeded data; any other non-empty id falls back to the base-plate part so the
 * page is reachable from real RFQ part ids while the data layer is still stubbed.
 * Returns `undefined` for a missing id so the page can render its empty state.
 */
export function getMockPart(partId: string): Part | undefined {
  if (!partId) return undefined;
  const seeded = MOCK_PARTS[partId];
  if (seeded) return seeded;
  return { ...BASE_PLATE, id: partId };
}
