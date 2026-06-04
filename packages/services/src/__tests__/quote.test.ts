import { db, parts } from "@uptool/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NotFoundError, ValidationError, quoteService } from "../index";
import { createOrg, createRfqWithPart, dropOrg } from "./helpers/fixtures";

// Mock the Resend SDK (dynamic-imported inside quoteService.sendQuote).
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: sendMock } })) }));

const createdOrgs: string[] = [];

afterEach(async () => {
  for (const id of createdOrgs.splice(0)) await dropOrg(id);
  sendMock.mockReset();
});

/** Org (+rfq+part) registered for teardown. */
async function setup() {
  const orgId = await createOrg();
  createdOrgs.push(orgId);
  const { rfqId, partId } = await createRfqWithPart(orgId);
  return { orgId, rfqId, partId };
}

function must<T>(value: T | undefined | null, message = "expected a value"): T {
  if (value == null) throw new Error(message);
  return value;
}

function readLine(id: string) {
  return db.query.quoteLineItems.findFirst({ where: (li, { eq: e }) => e(li.id, id) });
}

function readRfqStatus(id: string) {
  return db.query.rfqs
    .findFirst({ where: (r, { eq: e }) => e(r.id, id), columns: { status: true } })
    .then((r) => r?.status);
}

function readQuote(id: string) {
  return db.query.quotes.findFirst({ where: (q, { eq: e }) => e(q.id, id) });
}

/** Create a draft quote (one tier) and return the current quote's id/number. */
async function seedQuote(orgId: string, rfqId: string, partId: string) {
  await quoteService.addQuoteLineItem(orgId, rfqId, {
    partId,
    quantity: 1,
    costPerUnitCents: 5000,
    markupPct: 20,
  });
  const current = must(await quoteService.getCurrentQuote(orgId, rfqId));
  return { quoteId: current.id, quoteNumber: current.quoteNumber };
}

describe("addQuoteLineItem + money math", () => {
  test("computes quote unit/total (hand-checked), freezes cost, appends sortOrder", async () => {
    const { orgId, rfqId, partId } = await setup();
    const statusBefore = await readRfqStatus(rfqId);

    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 4667,
      markupPct: 30,
    });

    // round(4667 × 1.30) = round(6067.1) = 6067; × 10 = 60670
    expect(row.quoteUnitPriceCents).toBe(6067);
    expect(row.quoteTotalCents).toBe(60670);
    expect(row.costPerUnitCents).toBe(4667);
    expect(Number(row.markupPct)).toBe(30);
    expect(row.sortOrder).toBe(0);

    const back = must(await readLine(row.id));
    expect(back.quoteUnitPriceCents).toBe(6067);
    expect(back.quoteTotalCents).toBe(60670);

    // Granular mutations must NOT flip rfqs.status (status transitions are a later epic).
    expect(await readRfqStatus(rfqId)).toBe(statusBefore);
  });

  test("negative markup = discount", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 3,
      costPerUnitCents: 10000,
      markupPct: -15,
    });
    // round(10000 × 0.85) = 8500; × 3 = 25500
    expect(row.quoteUnitPriceCents).toBe(8500);
    expect(row.quoteTotalCents).toBe(25500);
  });

  test("rounds a discount (negative markup) half-up — pins direction", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 2,
      costPerUnitCents: 4150,
      markupPct: -25,
    });
    // 4150 × (1 − 0.25) = 4150 × 0.75 = 3112.5 → round half-up = 3113 (NOT floor → 3112).
    // -25% is chosen because 0.25/0.75 are exact in binary, so the .5 is not flaky.
    expect(row.quoteUnitPriceCents).toBe(3113);
    expect(row.quoteTotalCents).toBe(6226);
  });

  test("rounds half-up to the nearest cent", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 1,
      costPerUnitCents: 10,
      markupPct: 5,
    });
    // 10 × 1.05 = 10.5 → 11
    expect(row.quoteUnitPriceCents).toBe(11);
    expect(row.quoteTotalCents).toBe(11);
  });

  test("markup defaults to 0 when omitted", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 2,
      costPerUnitCents: 5000,
    });
    expect(row.quoteUnitPriceCents).toBe(5000);
    expect(row.quoteTotalCents).toBe(10000);
    expect(Number(row.markupPct)).toBe(0);
  });

  test("appends sortOrder and lists in order", async () => {
    const { orgId, rfqId, partId } = await setup();
    const a = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 1,
      costPerUnitCents: 1000,
    });
    const b = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 1000,
    });
    expect(a.sortOrder).toBe(0);
    expect(b.sortOrder).toBe(1);
    const list = await quoteService.listQuoteLineItems(orgId, rfqId);
    expect(list.map((l) => l.id)).toEqual([a.id, b.id]);
  });

  test("multiple line items → ONE quote, quote_counter +1 (not one per line)", async () => {
    const { orgId, rfqId, partId } = await setup();
    const before = must(
      await db.query.orgs.findFirst({
        where: (o, { eq: e }) => e(o.id, orgId),
        columns: { quoteCounter: true },
      }),
    );

    await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 1,
      costPerUnitCents: 1000,
    });
    await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 1000,
    });
    await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 100,
      costPerUnitCents: 1000,
    });

    const after = must(
      await db.query.orgs.findFirst({
        where: (o, { eq: e }) => e(o.id, orgId),
        columns: { quoteCounter: true },
      }),
    );
    // Three line items, but the draft quote is created once → exactly one number consumed.
    expect(after.quoteCounter).toBe(before.quoteCounter + 1);

    const quotes = await quoteService.findByRfq(orgId, rfqId);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.lineItems).toHaveLength(3);
  });
});

describe("duplicateQuoteLineItem (tier action)", () => {
  test("clones after the source with markup/lead reset; shifts later rows", async () => {
    const { orgId, rfqId, partId } = await setup();
    const a = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 5000,
      markupPct: 30,
      leadTimeWeeks: 4,
    });
    const b = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 100,
      costPerUnitCents: 4000,
      markupPct: 20,
    });

    const dup = await quoteService.duplicateQuoteLineItem(orgId, a.id);

    // Same part, qty, frozen cost — markup reset to 0, lead time + label cleared.
    expect(dup.partId).toBe(partId);
    expect(dup.quantity).toBe(10);
    expect(dup.costPerUnitCents).toBe(5000);
    expect(Number(dup.markupPct)).toBe(0);
    expect(dup.leadTimeWeeks).toBeNull();
    expect(dup.tierLabel).toBeNull();
    expect(dup.quoteUnitPriceCents).toBe(5000); // markup 0 → unit = cost
    expect(dup.sortOrder).toBe(a.sortOrder + 1);

    // Source untouched; later sibling shifted down.
    const aBack = must(await readLine(a.id));
    expect(Number(aBack.markupPct)).toBe(30);
    expect(aBack.leadTimeWeeks).toBe(4);
    const bBack = must(await readLine(b.id));
    expect(bBack.sortOrder).toBe(2);

    const list = await quoteService.listQuoteLineItems(orgId, rfqId);
    expect(list.map((l) => l.id)).toEqual([a.id, dup.id, b.id]);
  });
});

describe("updateQuoteLineItem", () => {
  test("recomputes unit/total on markup change; cost stays frozen", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 5000,
      markupPct: 30,
    });
    const upd = await quoteService.updateQuoteLineItem(orgId, row.id, { markupPct: 50 });
    expect(upd.quoteUnitPriceCents).toBe(7500); // 5000 × 1.5
    expect(upd.quoteTotalCents).toBe(75000);
    expect(upd.costPerUnitCents).toBe(5000);
  });

  test("recomputes total on quantity change", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 5000,
    });
    const upd = await quoteService.updateQuoteLineItem(orgId, row.id, { quantity: 20 });
    expect(upd.quoteUnitPriceCents).toBe(5000);
    expect(upd.quoteTotalCents).toBe(100000);
  });

  test("patching only lead time leaves price untouched", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 4,
      costPerUnitCents: 2500,
      markupPct: 10,
    });
    const upd = await quoteService.updateQuoteLineItem(orgId, row.id, { leadTimeWeeks: 6 });
    expect(upd.leadTimeWeeks).toBe(6);
    expect(upd.quoteUnitPriceCents).toBe(row.quoteUnitPriceCents);
    expect(upd.quoteTotalCents).toBe(row.quoteTotalCents);
  });
});

describe("reorderQuoteLineItems", () => {
  test("reorders the draft quote's items", async () => {
    const { orgId, rfqId, partId } = await setup();
    const a = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 1,
      costPerUnitCents: 1000,
    });
    const b = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 1000,
    });
    await quoteService.reorderQuoteLineItems(orgId, rfqId, [b.id, a.id]);
    const list = await quoteService.listQuoteLineItems(orgId, rfqId);
    expect(list.map((l) => l.id)).toEqual([b.id, a.id]);
    expect(list.map((l) => l.sortOrder)).toEqual([0, 1]);
  });

  test("rejects ids that aren't exactly the quote's items", async () => {
    const { orgId, rfqId, partId } = await setup();
    const a = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 1,
      costPerUnitCents: 1000,
    });
    const b = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 10,
      costPerUnitCents: 1000,
    });
    // Same count, but one id is foreign.
    await expect(
      quoteService.reorderQuoteLineItems(orgId, rfqId, [a.id, crypto.randomUUID()]),
    ).rejects.toBeInstanceOf(ValidationError);
    // Order unchanged.
    const list = await quoteService.listQuoteLineItems(orgId, rfqId);
    expect(list.map((l) => l.id)).toEqual([a.id, b.id]);
  });
});

describe("org scoping", () => {
  test("cross-org line-item id is rejected as not found (update/delete/duplicate)", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 5,
      costPerUnitCents: 5000,
      markupPct: 20,
    });

    const orgB = await createOrg();
    createdOrgs.push(orgB);

    await expect(
      quoteService.updateQuoteLineItem(orgB, row.id, { markupPct: 99 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(quoteService.deleteQuoteLineItem(orgB, row.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(quoteService.duplicateQuoteLineItem(orgB, row.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    // The real row is untouched.
    const back = must(await readLine(row.id));
    expect(Number(back.markupPct)).toBe(20);
  });

  test("addQuoteLineItem rejects a part from another org/rfq", async () => {
    const a = await setup();
    const b = await setup();
    await expect(
      quoteService.addQuoteLineItem(a.orgId, a.rfqId, {
        partId: b.partId,
        quantity: 1,
        costPerUnitCents: 1000,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("snapshot frozen", () => {
  test("changing the estimate after add does not change the line's cost", async () => {
    const { orgId, rfqId, partId } = await setup();
    const row = await quoteService.addQuoteLineItem(orgId, rfqId, {
      partId,
      quantity: 5,
      costPerUnitCents: 5000,
      markupPct: 20,
    });

    // Mutate the underlying part estimate after the line item is created.
    await db.update(parts).set({ materialCostCents: 999_999 }).where(eq(parts.id, partId));

    const back = must(await readLine(row.id));
    expect(back.costPerUnitCents).toBe(5000); // frozen snapshot — not recomputed on read
    expect(back.quoteUnitPriceCents).toBe(6000); // 5000 × 1.20 unchanged
  });
});

describe("updateQuoteNotes", () => {
  test("sets the draft quote's customer note (lazy-creates) without flipping status", async () => {
    const { orgId, rfqId } = await setup();
    const statusBefore = await readRfqStatus(rfqId);

    await quoteService.updateQuoteNotes(orgId, rfqId, "Lieferung frei Haus");
    const quotes = await quoteService.findByRfq(orgId, rfqId);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.notesForCustomer).toBe("Lieferung frei Haus");
    expect(quotes[0]?.status).toBe("draft");
    expect(await readRfqStatus(rfqId)).toBe(statusBefore);

    // Re-uses the same draft (no second quote).
    await quoteService.updateQuoteNotes(orgId, rfqId, "Updated note");
    const again = await quoteService.findByRfq(orgId, rfqId);
    expect(again).toHaveLength(1);
    expect(again[0]?.notesForCustomer).toBe("Updated note");
  });
});

describe("sendQuote", () => {
  test("emails via Resend, marks quote sent + rfq sent + sentAt", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    const { orgId, rfqId, partId } = await setup();
    const { quoteId } = await seedQuote(orgId, rfqId, partId);

    await quoteService.sendQuote(orgId, rfqId, {
      to: "customer@acme.test",
      subject: "Angebot #1",
      body: "Im Anhang.",
      pdfBase64: "QUJD",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0]?.[0];
    expect(payload.to).toEqual(["customer@acme.test"]);
    expect(payload.attachments[0].filename).toBe("Quote-1.pdf");
    expect(payload.attachments[0].content).toBe("QUJD");

    const q = must(await readQuote(quoteId));
    expect(q.status).toBe("sent");
    expect(q.sentAt).not.toBeNull();
    expect(await readRfqStatus(rfqId)).toBe("sent");
  });

  test("Resend failure → throws, DB unchanged", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { orgId, rfqId, partId } = await setup();
    const { quoteId } = await seedQuote(orgId, rfqId, partId);
    const rfqStatusBefore = await readRfqStatus(rfqId);

    await expect(
      quoteService.sendQuote(orgId, rfqId, {
        to: "customer@acme.test",
        subject: "Q",
        body: "x",
        pdfBase64: "QUJD",
      }),
    ).rejects.toThrow();

    const q = must(await readQuote(quoteId));
    expect(q.status).toBe("draft"); // unchanged
    expect(q.sentAt).toBeNull();
    expect(await readRfqStatus(rfqId)).toBe(rfqStatusBefore);
  });
});

describe("createQuoteRevision", () => {
  test("new draft + new number, line items copied, rfq → quoted", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
    const { orgId, rfqId, partId } = await setup();
    const { quoteId, quoteNumber } = await seedQuote(orgId, rfqId, partId);
    await quoteService.sendQuote(orgId, rfqId, {
      to: "customer@acme.test",
      subject: "Q",
      body: "x",
      pdfBase64: "QUJD",
    });

    const draft = await quoteService.createQuoteRevision(orgId, rfqId);

    expect(draft.id).not.toBe(quoteId);
    expect(draft.quoteNumber).toBe(quoteNumber + 1);
    expect(draft.status).toBe("draft");
    expect(await readRfqStatus(rfqId)).toBe("quoted");

    // The current quote is now the revision draft, with the copied line.
    const items = await quoteService.listQuoteLineItems(orgId, rfqId);
    expect(items).toHaveLength(1);
    expect(items[0]?.costPerUnitCents).toBe(5000);
  });

  test("throws when there is no sent quote to revise", async () => {
    const { orgId, rfqId, partId } = await setup();
    await seedQuote(orgId, rfqId, partId); // draft only, never sent
    await expect(quoteService.createQuoteRevision(orgId, rfqId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
