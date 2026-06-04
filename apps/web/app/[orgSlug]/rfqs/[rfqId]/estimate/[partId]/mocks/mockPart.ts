// Stub data for the per-part estimate / quoting page.
// Everything here is placeholder until the real estimate service lands in a
// later prompt. Values are lifted from the design screenshots in `assets/`.

import type { SourceRegion } from "../field-identity";

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
  /**
   * Bounding boxes locating where the AI read each extracted value on the source
   * drawing, keyed by field label (e.g. "Description", "Material"). The extraction
   * pipeline does not return these yet, so this is left undefined and no PDF
   * highlights are drawn. Real boxes light up the overlay once extraction returns
   * coordinates — see ADR 0011. Do NOT fabricate entries.
   */
  sourceRegions?: Record<string, SourceRegion>;
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

// MOCK header metadata only — geometry + AI-extraction verbatim shown in the
// part header / AI table. Real part identity (number/description/material/finish)
// is overlaid by the page from the DB; geometry + verbatim remain mock until the
// extraction epic. NOT the estimate data — ops/materials/notes come from the DB.
const BASE_PLATE: Part = {
  id: "mock-header",
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
  defaultWorkflowId: "sheet-metal",
  quantities: [1, 10, 100],
};

/**
 * Mock header metadata for a part (geometry + AI-extraction verbatim only). The
 * page overlays real identity from the DB; the estimate data (ops/materials/
 * notes) is loaded from the DB, not from here. Returns `undefined` for an empty id.
 */
export function getMockPart(partId: string): Part | undefined {
  if (!partId) return undefined;
  return { ...BASE_PLATE, id: partId };
}
