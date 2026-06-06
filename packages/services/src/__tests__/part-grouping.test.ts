import {
  type PairingResult,
  buildPartGroups,
  nameFromStem,
  needsAiPairing,
  parsePairingResponse,
  processTypeForExt,
} from "@uptool/shared";
import { describe, expect, test } from "vitest";

describe("nameFromStem", () => {
  test("separators → spaces, title-cased, embedded caps preserved", () => {
    expect(nameFromStem("bracket_rev_a")).toBe("Bracket Rev A");
    expect(nameFromStem("5216488_VentPlate")).toBe("5216488 VentPlate");
    expect(nameFromStem("part-001-final")).toBe("Part 001 Final");
  });
});

describe("processTypeForExt", () => {
  test("2D → Sheet Metal, solids → CNC Milling, unknown → null", () => {
    expect(processTypeForExt(".dxf")).toBe("Sheet Metal");
    expect(processTypeForExt(".dwg")).toBe("Sheet Metal");
    expect(processTypeForExt(".step")).toBe("CNC Milling");
    expect(processTypeForExt(".iges")).toBe("CNC Milling");
    expect(processTypeForExt(".pdf")).toBeNull();
  });
});

describe("needsAiPairing", () => {
  test("true only when ≥2 CAD files", () => {
    expect(needsAiPairing([{ id: "a", filename: "x.step" }])).toBe(false);
    expect(needsAiPairing([{ id: "a", filename: "x.pdf" }])).toBe(false);
    expect(
      needsAiPairing([
        { id: "a", filename: "x.step" },
        { id: "b", filename: "x.pdf" },
      ]),
    ).toBe(false);
    expect(
      needsAiPairing([
        { id: "a", filename: "x.step" },
        { id: "b", filename: "y.dxf" },
      ]),
    ).toBe(true);
  });
});

describe("buildPartGroups — fast path (no Claude)", () => {
  test("1 STEP + 1 PDF → 1 part, PDF linked, CNC Milling", () => {
    const groups = buildPartGroups([
      { id: "a1", filename: "5216488_VentPlate.STEP" },
      { id: "a2", filename: "5216488_VentPlate.pdf" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("5216488 VentPlate");
    expect(groups[0]?.processType).toBe("CNC Milling");
    expect(groups[0]?.attachmentIds).toEqual(["a1", "a2"]);
  });

  test("1 STEP + 1 PDF with DIFFERENT stems → still 1 part, both linked (the 1101 bug)", () => {
    const groups = buildPartGroups([
      { id: "a1", filename: "d1227434_SEAFASTENING_SET_TYP_1.step" },
      { id: "a2", filename: "d1227435_AU11330_1712_CAD_OD_OWNERS_STUDY_SEA_FASTENING_SET_1.pdf" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.attachmentIds).toEqual(["a1", "a2"]);
    expect(groups[0]?.processType).toBe("CNC Milling");
  });

  test("1 STEP only → 1 part", () => {
    const groups = buildPartGroups([{ id: "a1", filename: "bracket.step" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.attachmentIds).toEqual(["a1"]);
  });

  test("lone PDF → 1 part, null processType", () => {
    const groups = buildPartGroups([{ id: "a1", filename: "mystery_drawing.pdf" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.processType).toBeNull();
    expect(groups[0]?.attachmentIds).toEqual(["a1"]);
  });

  test("≥2 CAD with no pairing → fallback: one part per CAD, PDFs unlinked", () => {
    const groups = buildPartGroups([
      { id: "a1", filename: "alpha.step" },
      { id: "a2", filename: "beta.step" },
      { id: "a3", filename: "some_drawing.pdf" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.attachmentIds)).toEqual([["a1"], ["a2"]]);
    // the PDF is not linked to any part in the fallback
    expect(groups.flatMap((g) => g.attachmentIds)).not.toContain("a3");
  });

  test("no manufacturing files → no parts", () => {
    expect(buildPartGroups([])).toEqual([]);
  });
});

describe("buildPartGroups — slow path (Claude pairing)", () => {
  const files = [
    { id: "c1", filename: "d100_bracket.step" },
    { id: "c2", filename: "d200_housing.step" },
    { id: "p1", filename: "d101_bracket_drawing.pdf" },
    { id: "p2", filename: "d201_housing_print.pdf" },
  ];

  test("2 STEP + 2 PDF → Claude groups → 2 parts each with its PDF", () => {
    const pairing: PairingResult = {
      parts: [
        { cad: "d100_bracket.step", pdfs: ["d101_bracket_drawing.pdf"] },
        { cad: "d200_housing.step", pdfs: ["d201_housing_print.pdf"] },
      ],
      unmatchedPdfs: [],
    };
    const groups = buildPartGroups(files, pairing);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.attachmentIds).toEqual(["c1", "p1"]);
    expect(groups[1]?.attachmentIds).toEqual(["c2", "p2"]);
  });

  test("unmatched_pdfs stay unlinked", () => {
    const pairing: PairingResult = {
      parts: [
        { cad: "d100_bracket.step", pdfs: [] },
        { cad: "d200_housing.step", pdfs: [] },
      ],
      unmatchedPdfs: ["d101_bracket_drawing.pdf", "d201_housing_print.pdf"],
    };
    const groups = buildPartGroups(files, pairing);
    expect(groups).toHaveLength(2);
    const linked = groups.flatMap((g) => g.attachmentIds);
    expect(linked).not.toContain("p1");
    expect(linked).not.toContain("p2");
  });

  test("CAD Claude omitted still gets its own part (safety net)", () => {
    const pairing: PairingResult = {
      parts: [{ cad: "d100_bracket.step", pdfs: ["d101_bracket_drawing.pdf"] }],
      unmatchedPdfs: [],
    };
    const groups = buildPartGroups(files, pairing);
    // d200_housing.step was dropped by Claude → recovered as its own part
    expect(groups.map((g) => g.attachmentIds)).toContainEqual(["c2"]);
  });
});

describe("parsePairingResponse", () => {
  test("parses clean JSON", () => {
    const r = parsePairingResponse(
      '{"parts":[{"cad":"a.step","pdfs":["a.pdf"]}],"unmatched_pdfs":["b.pdf"]}',
    );
    expect(r.parts).toEqual([{ cad: "a.step", pdfs: ["a.pdf"] }]);
    expect(r.unmatchedPdfs).toEqual(["b.pdf"]);
  });

  test("tolerates ```json fences and surrounding prose", () => {
    const r = parsePairingResponse(
      'Here you go:\n```json\n{"parts":[{"cad":"a.step","pdfs":[]}]}\n```',
    );
    expect(r.parts).toEqual([{ cad: "a.step", pdfs: [] }]);
    expect(r.unmatchedPdfs).toEqual([]);
  });

  test("throws on non-JSON or wrong shape (→ caller falls back)", () => {
    expect(() => parsePairingResponse("sorry, I can't")).toThrow();
    expect(() => parsePairingResponse('{"foo":1}')).toThrow();
  });
});
