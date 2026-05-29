// Stub file references for the right-pane viewer. Real per-part files arrive
// with the storage layer in a later epic. Sample assets live in /public/samples.

export interface FileRef {
  id: string;
  name: string;
  url: string;
}

export interface PartFiles {
  drawings: FileRef[];
  cad: FileRef[];
}

const PART_1: PartFiles = {
  drawings: [
    {
      id: "62407a44-5edb-48ed-894a-e5a9526b1c2d",
      name: "62407a44-5edb-48ed-894a-e5a9526b1c2d.pdf",
      url: "/samples/072-93083.pdf",
    },
  ],
  cad: [{ id: "cad-072-93083", name: "Vent Plate - Pub", url: "/samples/072-93083.STEP" }],
};

const FILES: Record<string, PartFiles> = {
  p1: PART_1,
  p2: {
    drawings: [
      {
        id: "9b1f2c70-8a44-4e1b-9d3a-1c5e72f40a11",
        name: "9b1f2c70-8a44-4e1b-9d3a-1c5e72f40a11.pdf",
        url: "/samples/072-93105.pdf",
      },
    ],
    cad: [{ id: "cad-072-93105", name: "Mounting Bracket", url: "/samples/072-93105.STEP" }],
  },
};

/** Demo ids (p1/p2) return seeded files; any other id falls back to part 1. */
export function getMockFiles(partId: string): PartFiles {
  return FILES[partId] ?? PART_1;
}
