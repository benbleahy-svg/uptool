import { db } from "@uptool/db";
import { afterEach, describe, expect, test } from "vitest";
import { NotFoundError, ValidationError, estimateService, rfqService } from "../index";
import { createOrg, createPart, createRfqWithPart, dropOrg } from "./helpers/fixtures";

const createdOrgs: string[] = [];

afterEach(async () => {
  for (const id of createdOrgs.splice(0)) await dropOrg(id);
});

/** Create an org (+rfq+part) registered for teardown. */
async function setup() {
  const orgId = await createOrg();
  createdOrgs.push(orgId);
  const { rfqId, partId } = await createRfqWithPart(orgId);
  return { orgId, rfqId, partId };
}

async function readPart(partId: string) {
  return db.query.parts.findFirst({ where: (p, { eq }) => eq(p.id, partId) });
}

/** Narrow away undefined from array destructuring without a non-null assertion. */
function must<T>(value: T | undefined | null, message = "expected a value"): T {
  if (value == null) throw new Error(message);
  return value;
}

describe("hydratePartEstimate", () => {
  test("seeds defaults; second call is an idempotent no-op", async () => {
    const { orgId, partId } = await setup();

    await estimateService.hydratePartEstimate(orgId, partId);
    const ops1 = await estimateService.listPartOperations(orgId, partId);
    const mats1 = await estimateService.listPartMaterials(orgId, partId);

    expect(ops1).toHaveLength(4);
    // The fixture part has no process_type → the generic op set (Machining, not a
    // process-specific op). Sheet Metal / CNC sets are exercised by the formula tests.
    expect(ops1.map((o) => o.name)).toEqual([
      "Programming",
      "Machining",
      "QA / Inspection",
      "Packaging & Shipping",
    ]);
    expect(ops1.every((o) => o.userTouched === false)).toBe(true);
    expect(mats1).toHaveLength(1);
    expect(mats1[0]?.materialType).toBe("sheet");

    const part1 = await readPart(partId);
    expect(part1?.estimateHydratedAt).toBeTruthy();
    const stamp = String(part1?.estimateHydratedAt);

    // Second call: no duplicate rows, timestamp unchanged.
    await estimateService.hydratePartEstimate(orgId, partId);
    expect(await estimateService.listPartOperations(orgId, partId)).toHaveLength(4);
    expect(await estimateService.listPartMaterials(orgId, partId)).toHaveLength(1);
    const part2 = await readPart(partId);
    expect(String(part2?.estimateHydratedAt)).toBe(stamp);
  });
});

describe("operations CRUD", () => {
  test("add → read back shape; added op is user-touched", async () => {
    const { orgId, partId } = await setup();
    const op = await estimateService.addPartOperation(orgId, partId, {
      name: "Deburr",
      setupMinutes: 5,
      runMinutes: 2,
      isNonRecurring: false,
    });
    expect(op.name).toBe("Deburr");
    expect(Number(op.setupMinutes)).toBe(5);
    expect(op.userTouched).toBe(true);

    const list = await estimateService.listPartOperations(orgId, partId);
    expect(list.map((o) => o.id)).toContain(op.id);
  });

  test("update flips user_touched and writes the field", async () => {
    const { orgId, partId } = await setup();
    await estimateService.hydratePartEstimate(orgId, partId);
    const [first] = await estimateService.listPartOperations(orgId, partId);
    expect(first?.userTouched).toBe(false);

    const updated = await estimateService.updatePartOperation(orgId, must(first).id, {
      setupMinutes: 99,
    });
    expect(updated.userTouched).toBe(true);
    expect(Number(updated.setupMinutes)).toBe(99);
  });

  test("clearPartOperationOverride nulls the column but leaves user_touched true", async () => {
    const { orgId, partId } = await setup();
    await estimateService.hydratePartEstimate(orgId, partId);
    const [, second] = await estimateService.listPartOperations(orgId, partId);

    const withMarkup = await estimateService.updatePartOperation(orgId, must(second).id, {
      markupPct: 10,
    });
    expect(Number(withMarkup.markupPct)).toBe(10);
    expect(withMarkup.userTouched).toBe(true);

    const cleared = await estimateService.clearPartOperationOverride(
      orgId,
      must(second).id,
      "markup",
    );
    expect(cleared.markupPct).toBeNull();
    expect(cleared.userTouched).toBe(true); // not reset
  });

  test("reorder rejects ids from a different part", async () => {
    const { orgId, rfqId, partId } = await setup();
    await estimateService.hydratePartEstimate(orgId, partId);

    const otherPartId = await createPart(orgId, rfqId);
    await estimateService.hydratePartEstimate(orgId, otherPartId);
    const otherOps = await estimateService.listPartOperations(orgId, otherPartId);

    // Same length (4) but every id belongs to the other part → rejected.
    await expect(
      estimateService.reorderPartOperations(
        orgId,
        partId,
        otherOps.map((o) => o.id),
      ),
    ).rejects.toThrow(ValidationError);
  });

  test("reorder updates sort_order for a valid permutation", async () => {
    const { orgId, partId } = await setup();
    await estimateService.hydratePartEstimate(orgId, partId);
    const ops = await estimateService.listPartOperations(orgId, partId);
    const reversed = ops.map((o) => o.id).reverse();

    await estimateService.reorderPartOperations(orgId, partId, reversed);
    const after = await estimateService.listPartOperations(orgId, partId);
    expect(after.map((o) => o.id)).toEqual(reversed);
  });
});

describe("materials CRUD", () => {
  test("add → list; update replaces fields wholesale", async () => {
    const { orgId, partId } = await setup();
    const mat = await estimateService.addPartMaterial(orgId, partId, {
      materialType: "round_bar",
      fields: { diameter: "20", grade: "C45" },
    });
    expect(mat.materialType).toBe("round_bar");
    expect((mat.fields as Record<string, unknown>).diameter).toBe("20");

    const updated = await estimateService.updatePartMaterial(orgId, mat.id, {
      fields: { diameter: "25" },
    });
    expect(updated.fields).toEqual({ diameter: "25" }); // grade gone — wholesale replace

    await estimateService.deletePartMaterial(orgId, mat.id);
    expect(await estimateService.listPartMaterials(orgId, partId)).toHaveLength(0);
  });
});

describe("notes semantics", () => {
  test("string writes (incl. ''); null/omitted leaves unchanged", async () => {
    const { orgId, partId } = await setup();

    await estimateService.updatePartNotes(orgId, partId, { external: "hello" });
    expect((await readPart(partId))?.notesExternal).toBe("hello");

    // "" clears internal; external untouched
    await estimateService.updatePartNotes(orgId, partId, { internal: "" });
    let p = await readPart(partId);
    expect(p?.notesInternal).toBe("");
    expect(p?.notesExternal).toBe("hello");

    // null = don't change
    await estimateService.updatePartNotes(orgId, partId, { external: null });
    p = await readPart(partId);
    expect(p?.notesExternal).toBe("hello");
  });
});

describe("RFQ quote bulk", () => {
  test("writes values; clears with null", async () => {
    const { orgId, rfqId } = await setup();
    await estimateService.updateRfqQuoteBulk(orgId, rfqId, { markupPct: 30, discountPct: 5 });
    const rfq1 = await db.query.rfqs.findFirst({ where: (r, { eq }) => eq(r.id, rfqId) });
    expect(Number(rfq1?.quoteBulkMarkupPct)).toBe(30);
    expect(Number(rfq1?.quoteBulkDiscountPct)).toBe(5);

    await estimateService.updateRfqQuoteBulk(orgId, rfqId, { markupPct: null });
    const rfq2 = await db.query.rfqs.findFirst({ where: (r, { eq }) => eq(r.id, rfqId) });
    expect(rfq2?.quoteBulkMarkupPct).toBeNull();
    expect(Number(rfq2?.quoteBulkDiscountPct)).toBe(5); // unchanged
  });
});

describe("org scoping", () => {
  test("cross-org read is empty; update/delete/quote-bulk reject", async () => {
    const { orgId: orgA, rfqId: rfqA, partId: partA } = await setup();
    await estimateService.hydratePartEstimate(orgA, partA);
    const [opA] = await estimateService.listPartOperations(orgA, partA);
    const [matA] = await estimateService.listPartMaterials(orgA, partA);

    const orgB = await createOrg();
    createdOrgs.push(orgB);

    expect(await estimateService.listPartOperations(orgB, partA)).toHaveLength(0);
    expect(await estimateService.listPartMaterials(orgB, partA)).toHaveLength(0);

    await expect(
      estimateService.updatePartOperation(orgB, must(opA).id, { setupMinutes: 1 }),
    ).rejects.toThrow(NotFoundError);
    await expect(estimateService.deletePartOperation(orgB, must(opA).id)).rejects.toThrow(
      NotFoundError,
    );
    await expect(estimateService.deletePartMaterial(orgB, must(matA).id)).rejects.toThrow(
      NotFoundError,
    );
    await expect(estimateService.updateRfqQuoteBulk(orgB, rfqA, { markupPct: 10 })).rejects.toThrow(
      NotFoundError,
    );

    // orgA's data is intact after the failed cross-org attempts.
    expect(await estimateService.listPartOperations(orgA, partA)).toHaveLength(4);
  });
});

describe("zod validation", () => {
  test("bad inputs reject with ValidationError", async () => {
    const { orgId, rfqId, partId } = await setup();

    await expect(
      estimateService.addPartMaterial(orgId, partId, {
        materialType: "",
        fields: {},
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      estimateService.updateRfqQuoteBulk(orgId, rfqId, { markupPct: 150 }),
    ).rejects.toThrow(ValidationError);

    await expect(
      estimateService.updatePartOperation(orgId, crypto.randomUUID(), {
        volumeDiscountTiers: [{ minQty: -1, discountPct: 5 }],
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("reset convergence (rfqService.resetEstimate)", () => {
  test("clears operations, materials, hydration flag, and quote bulk", async () => {
    const { orgId, rfqId, partId } = await setup();
    await estimateService.hydratePartEstimate(orgId, partId);
    await estimateService.updateRfqQuoteBulk(orgId, rfqId, { markupPct: 30, discountPct: 5 });

    expect((await estimateService.listPartOperations(orgId, partId)).length).toBeGreaterThan(0);
    expect((await estimateService.listPartMaterials(orgId, partId)).length).toBeGreaterThan(0);
    const before = await readPart(partId);
    expect(before?.estimateHydratedAt).toBeTruthy();

    await rfqService.resetEstimate(orgId, rfqId);

    expect(await estimateService.listPartOperations(orgId, partId)).toHaveLength(0);
    expect(await estimateService.listPartMaterials(orgId, partId)).toHaveLength(0);
    const part = await readPart(partId);
    expect(part?.estimateHydratedAt).toBeNull(); // re-hydrates on next open
    const rfq = await db.query.rfqs.findFirst({ where: (r, { eq }) => eq(r.id, rfqId) });
    expect(rfq?.quoteBulkMarkupPct).toBeNull();
    expect(rfq?.quoteBulkDiscountPct).toBeNull();
    expect(rfq?.status).toBe("new");
  });
});
