import {
  groupAttachmentsIntoParts,
  nameFromStem,
  normalizeStem,
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
    expect(processTypeForExt(".stp")).toBe("CNC Milling");
    expect(processTypeForExt(".iges")).toBe("CNC Milling");
    expect(processTypeForExt(".pdf")).toBeNull();
  });
});

describe("normalizeStem", () => {
  test("strips separators + common drawing/rev suffixes for matching", () => {
    expect(normalizeStem("5216488_VentPlate")).toBe("5216488ventplate");
    expect(normalizeStem("bracket_rev_a")).toBe("bracket");
    expect(normalizeStem("bracket_drawing")).toBe("bracket");
    expect(normalizeStem("part_v1")).toBe("part");
  });
});

describe("groupAttachmentsIntoParts", () => {
  test("STEP + matching PDF → one part, both linked, CNC Milling", () => {
    const groups = groupAttachmentsIntoParts([
      { id: "a1", filename: "5216488_VentPlate.STEP" },
      { id: "a2", filename: "5216488_VentPlate.pdf" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("5216488 VentPlate");
    expect(groups[0]?.processType).toBe("CNC Milling");
    expect(groups[0]?.attachmentIds).toEqual(["a1", "a2"]);
  });

  test("two unrelated STEP files → two parts", () => {
    const groups = groupAttachmentsIntoParts([
      { id: "a1", filename: "alpha.step" },
      { id: "a2", filename: "beta.step" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.name)).toEqual(["Alpha", "Beta"]);
    expect(groups.every((g) => g.processType === "CNC Milling")).toBe(true);
  });

  test("lone PDF → one part with null processType", () => {
    const groups = groupAttachmentsIntoParts([{ id: "a1", filename: "mystery_drawing.pdf" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.processType).toBeNull();
    expect(groups[0]?.attachmentIds).toEqual(["a1"]);
  });

  test("lone DXF → Sheet Metal", () => {
    const groups = groupAttachmentsIntoParts([{ id: "a1", filename: "bracket_rev_a.dxf" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("Bracket Rev A");
    expect(groups[0]?.processType).toBe("Sheet Metal");
  });

  test("PDF whose stem matches a CAD via suffix-stripping links to it", () => {
    const groups = groupAttachmentsIntoParts([
      { id: "a1", filename: "bracket_rev_a.dxf" },
      { id: "a2", filename: "bracket_drawing.pdf" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.attachmentIds).toEqual(["a1", "a2"]);
  });

  test("no manufacturing files → no parts", () => {
    expect(groupAttachmentsIntoParts([])).toEqual([]);
  });
});
