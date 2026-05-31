import { and, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://uptool:uptool@localhost:5432/uptool";

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// ── Status-pill demo RFQs ───────────────────────────────────────────────────
// One RFQ per dashboard pill state so the Anfragen Dashboard shows every state
// at once. The four progress states (New/Estimated/Quoted/Sent) are STORED enum
// values, so we set `status` directly. "Declined" is DERIVED (getRfqStatus), so
// we exercise BOTH real routes: every part no-bid (status stays "estimated") and
// an explicit `declinedAt`. Won/Lost are included for full pill coverage.
// All rows use the "seed-status.test" domain + 109x numbers so re-seeding can
// clear them idempotently.
const DEMO_DOMAIN = "seed-status.test";
const DEMO_NUMBERS = [1090, 1091, 1092, 1093, 1094, 1095, 1096, 1097];

interface DemoQuote {
  quoteNumber: number;
  status: "draft" | "sent";
  sentAt?: Date;
}
interface DemoRfq {
  rfqNumber: number;
  company: string;
  subject: string;
  status: "new" | "estimated" | "quoted" | "sent" | "won" | "lost" | "no_bid";
  declinedAt?: Date;
  declinedReason?: string;
  parts: Array<{ description: string; isNoBid: boolean }>;
  quote?: DemoQuote;
  receivedAt: Date;
  lastEmailAt?: Date;
}

const D = (iso: string) => new Date(iso);
const DEMO: DemoRfq[] = [
  {
    rfqNumber: 1090,
    company: "Seed — New GmbH",
    subject: "Seed: New — parts present, nothing estimated yet",
    status: "new",
    parts: [
      { description: "Bracket A", isNoBid: false },
      { description: "Bracket B", isNoBid: false },
    ],
    receivedAt: D("2026-05-31T08:05:00Z"),
  },
  {
    rfqNumber: 1091,
    company: "Seed — Estimated GmbH",
    subject: "Seed: Estimated — mixed complete + one no-bid (stays Estimated)",
    status: "estimated",
    // One part no-bid + one not → NOT all-no-bid, so it stays Estimated.
    parts: [
      { description: "Housing (complete)", isNoBid: false },
      { description: "Insert (no-bid)", isNoBid: true },
    ],
    receivedAt: D("2026-05-30T10:20:00Z"),
  },
  {
    rfqNumber: 1092,
    company: "Seed — Quote Created GmbH",
    subject: "Seed: Quote Created — draft quote, not sent",
    status: "quoted",
    parts: [{ description: "Flange", isNoBid: false }],
    quote: { quoteNumber: 91092, status: "draft" },
    receivedAt: D("2026-05-29T13:00:00Z"),
  },
  {
    rfqNumber: 1093,
    company: "Seed — Quote Sent GmbH",
    subject: "Seed: Quote Sent — sent quote with timestamp",
    status: "sent",
    parts: [{ description: "Manifold", isNoBid: false }],
    quote: { quoteNumber: 91093, status: "sent", sentAt: D("2026-05-30T15:42:00Z") },
    receivedAt: D("2026-05-28T09:30:00Z"),
    lastEmailAt: D("2026-05-30T15:42:00Z"),
  },
  {
    rfqNumber: 1094,
    company: "Seed — Declined (all no-bid) GmbH",
    subject: "Seed: Declined via every part no-bid (status stays estimated)",
    // Stored status is NOT no_bid — Declined is derived purely from all parts
    // being no-bid, exercising the auto-decline route.
    status: "estimated",
    parts: [
      { description: "Part X (no-bid)", isNoBid: true },
      { description: "Part Y (no-bid)", isNoBid: true },
    ],
    receivedAt: D("2026-05-27T11:10:00Z"),
  },
  {
    rfqNumber: 1095,
    company: "Seed — Declined (explicit) GmbH",
    subject: "Seed: Declined via explicit declinedAt",
    status: "no_bid",
    declinedAt: D("2026-05-29T16:25:00Z"),
    declinedReason: "Capacity — outside current process window",
    parts: [{ description: "Bushing", isNoBid: false }],
    receivedAt: D("2026-05-26T14:00:00Z"),
    lastEmailAt: D("2026-05-29T16:25:00Z"),
  },
  {
    rfqNumber: 1096,
    company: "Seed — Won GmbH",
    subject: "Seed: Won",
    status: "won",
    parts: [{ description: "Shaft", isNoBid: false }],
    receivedAt: D("2026-05-25T09:00:00Z"),
  },
  {
    rfqNumber: 1097,
    company: "Seed — Lost GmbH",
    subject: "Seed: Lost",
    status: "lost",
    parts: [{ description: "Cover", isNoBid: false }],
    receivedAt: D("2026-05-24T09:00:00Z"),
  },
];

async function seedRfq() {
  console.log("Seeding test RFQ 1004...");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, "acme"),
  });

  if (!org) {
    console.error("Org 'acme' not found — run pnpm db:seed first.");
    await client.end();
    process.exit(1);
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${org.id}, true)`);

    // Delete existing test data so the seed is idempotent
    const existing = await tx.query.rfqs.findFirst({
      where: (r, { and, eq }) => and(eq(r.orgId, org.id), eq(r.rfqNumber, 1004)),
    });
    if (existing) {
      await tx.delete(schema.rfqs).where(and(eq(schema.rfqs.orgId, org.id), eq(schema.rfqs.rfqNumber, 1004)));
    }
    await tx.delete(schema.customers).where(
      and(eq(schema.customers.orgId, org.id), eq(schema.customers.domain, "vogt-praezision.de")),
    );

    // Customer
    const [customer] = await tx
      .insert(schema.customers)
      .values({
        orgId: org.id,
        name: "Vogt Präzisionsteile GmbH",
        domain: "vogt-praezision.de",
        source: "ai_extracted",
        extractionConfidence: "0.97",
      })
      .returning();
    if (!customer) throw new Error("Failed to insert customer");

    // Contact
    const [contact] = await tx
      .insert(schema.contacts)
      .values({
        orgId: org.id,
        customerId: customer.id,
        email: "m.steinberg@vogt-praezision.de",
        name: "Marcus Steinberg",
      })
      .returning();
    if (!contact) throw new Error("Failed to insert contact");

    const receivedAt = new Date("2026-05-27T09:14:00Z");

    // RFQ
    const [rfq] = await tx
      .insert(schema.rfqs)
      .values({
        orgId: org.id,
        rfqNumber: 1004,
        customerId: customer.id,
        contactId: contact.id,
        subject: "Anfrage Baugruppe Hydraulikverteiler – 3 Pos.",
        source: "email",
        quantityBreaks: [1, 10, 100],
        status: "new",
        receivedAt,
        lastEmailAt: receivedAt,
      })
      .returning();
    if (!rfq) throw new Error("Failed to insert RFQ");

    // Email thread + message
    const [thread] = await tx
      .insert(schema.emailThreads)
      .values({
        orgId: org.id,
        rfqId: rfq.id,
        providerThreadId: "AAQkADVogt2026052701",
        provider: "microsoft",
      })
      .returning();
    if (!thread) throw new Error("Failed to insert email thread");

    const [inboundMsg] = await tx.insert(schema.emailMessages).values({
      orgId: org.id,
      threadId: thread.id,
      providerMessageId: "AAMkADVogt2026052701-001",
      direction: "inbound",
      fromEmail: "m.steinberg@vogt-praezision.de",
      fromName: "Marcus Steinberg",
      toEmails: ["rfq+acme@in.toolup.de"],
      subject: "Anfrage Baugruppe Hydraulikverteiler – 3 Pos.",
      bodyText: `Sehr geehrte Damen und Herren,

wir bitten um Ihr Angebot für folgende Bauteile, die wir für eine laufende Serienumrüstung benötigen:

Pos. 1: Verteilerblock Typ VB-40 (Aluminium EN AW-6082, gefräst)
        Menge: 1 / 10 / 100 Stück
        Zeichnung und STEP-Datei im Anhang

Pos. 2: Anschlussplatte AP-12 (Edelstahl 1.4301, gefräst)
        Menge: 1 / 10 / 100 Stück
        Zeichnung und STEP-Datei im Anhang

Pos. 3: Haltebügel HB-07 (DC01, Biegeteil)
        Menge: 1 / 10 / 100 Stück
        Zeichnung im Anhang

Gewünschte Lieferzeit: 4–6 Wochen ab Auftragsbestätigung
Lieferung frei Haus: 85716 Unterschleißheim

Für Rückfragen stehe ich gerne zur Verfügung.

Mit freundlichen Grüßen
Marcus Steinberg
Einkauf / Beschaffung

Vogt Präzisionsteile GmbH
Industriestraße 14
85716 Unterschleißheim
Tel.: +49 89 3105-2840
m.steinberg@vogt-praezision.de`,
      receivedAt,
    }).returning();
    if (!inboundMsg) throw new Error("Failed to insert inbound message");

    const outboundAt = new Date("2026-05-27T11:42:00Z");
    const [outboundMsg] = await tx.insert(schema.emailMessages).values({
      orgId: org.id,
      threadId: thread.id,
      providerMessageId: "AAMkADVogt2026052701-002",
      direction: "outbound",
      fromEmail: "rfq+acme@in.toolup.de",
      fromName: "Acme GmbH",
      toEmails: ["m.steinberg@vogt-praezision.de"],
      subject: "Re: Anfrage Baugruppe Hydraulikverteiler – 3 Pos.",
      bodyText: `Dear Mr. Steinberg,

Thank you for your inquiry. We have reviewed your request and are pleased to confirm we can manufacture all three positions.

We will prepare a detailed quotation for quantities 1 / 10 / 100 pcs and send it to you within the next 2–3 business days.

Please note we will require clarification on the surface finish specification for Pos. 1 (VB-40) — could you confirm whether anodising is required?

Best regards,
Acme GmbH`,
      status: "sent",
      receivedAt: outboundAt,
    }).returning();
    if (!outboundMsg) throw new Error("Failed to insert outbound message");

    await tx.insert(schema.attachments).values({
      orgId: org.id,
      rfqId: rfq.id,
      messageId: outboundMsg.id,
      filename: "Acme_RFQ1004_Acknowledgement.pdf",
      contentType: "application/pdf",
      sizeBytes: 54_200,
      storageKey: "acme/attachments/rfq1004-acknowledgement.pdf",
      category: "other",
    });

    // Parts (English)
    const [part1] = await tx
      .insert(schema.parts)
      .values({
        orgId: org.id,
        rfqId: rfq.id,
        partNumber: "5216488",
        revision: "A",
        description: "BASE PLATE, VENT PLATE - PUB",
        processType: "sheet_metal",
        sortOrder: 0,
      })
      .returning();
    if (!part1) throw new Error("Failed to insert part 1");

    const [part2] = await tx
      .insert(schema.parts)
      .values({
        orgId: org.id,
        rfqId: rfq.id,
        partNumber: "4990202",
        revision: "A",
        description: "MOUNTING BRACKET, COLLAR MOUNTING BRACKET - PUB",
        processType: "cnc_milling",
        sortOrder: 1,
      })
      .returning();
    if (!part2) throw new Error("Failed to insert part 2");

    const [part3] = await tx
      .insert(schema.parts)
      .values({
        orgId: org.id,
        rfqId: rfq.id,
        partNumber: "PEAT Motor Stand",
        revision: null,
        description: "PEAT MOTOR STAND",
        processType: "cnc_milling",
        sortOrder: 2,
      })
      .returning();
    if (!part3) throw new Error("Failed to insert part 3");

    // Attachments linked to parts
    await tx.insert(schema.attachments).values([
      {
        orgId: org.id,
        rfqId: rfq.id,
        partId: part1.id,
        filename: "Vent Plate - Pub - Drw V1.pdf",
        contentType: "application/pdf",
        sizeBytes: 418_600,
        storageKey: "acme/attachments/vent-plate-pub-drw-v1.pdf",
        category: "drawing",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partId: part1.id,
        filename: "Vent Plate - Pub.step",
        contentType: "application/octet-stream",
        sizeBytes: 2_840_000,
        storageKey: "acme/attachments/vent-plate-pub.step",
        category: "cad",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partId: part2.id,
        filename: "Collar Mounting Bracket - Pub - Drw V1.pdf",
        contentType: "application/pdf",
        sizeBytes: 312_400,
        storageKey: "acme/attachments/collar-mounting-bracket-pub-drw-v1.pdf",
        category: "drawing",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partId: part2.id,
        filename: "Collar Mounting Bracket - Pub.step",
        contentType: "application/octet-stream",
        sizeBytes: 1_175_000,
        storageKey: "acme/attachments/collar-mounting-bracket-pub.step",
        category: "cad",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partId: part3.id,
        filename: "PEAT Motor Stand.pdf",
        contentType: "application/pdf",
        sizeBytes: 89_200,
        storageKey: "acme/attachments/peat-motor-stand.pdf",
        category: "drawing",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partId: part3.id,
        filename: "PEAT Motor Stand.STEP",
        contentType: "application/octet-stream",
        sizeBytes: 654_000,
        storageKey: "acme/attachments/peat-motor-stand.step",
        category: "cad",
      },
    ]);

    console.log(`Created RFQ #1004 for ${customer.name}`);
    console.log("  Parts: 5216488 (sheet_metal), 4990202 (cnc_milling), PEAT Motor Stand (cnc_milling)");
    console.log("  Attachments: 3 drawings, 3 CAD files, all linked to parts");

    // ── Status-pill demo RFQs (idempotent) ──────────────────────────────────
    // Clear prior demo rows first. Deleting the RFQs cascades to their parts and
    // quotes; contacts/customers are removed by the shared demo domain.
    await tx
      .delete(schema.rfqs)
      .where(and(eq(schema.rfqs.orgId, org.id), inArray(schema.rfqs.rfqNumber, DEMO_NUMBERS)));
    await tx
      .delete(schema.contacts)
      .where(and(eq(schema.contacts.orgId, org.id), like(schema.contacts.email, `%@${DEMO_DOMAIN}`)));
    await tx
      .delete(schema.customers)
      .where(and(eq(schema.customers.orgId, org.id), eq(schema.customers.domain, DEMO_DOMAIN)));

    for (const d of DEMO) {
      const [cust] = await tx
        .insert(schema.customers)
        .values({ orgId: org.id, name: d.company, domain: DEMO_DOMAIN, source: "manual" })
        .returning();
      if (!cust) throw new Error(`Failed to insert demo customer ${d.company}`);

      const [ct] = await tx
        .insert(schema.contacts)
        .values({
          orgId: org.id,
          customerId: cust.id,
          email: `buyer+${d.rfqNumber}@${DEMO_DOMAIN}`,
          name: "Test Buyer",
        })
        .returning();
      if (!ct) throw new Error(`Failed to insert demo contact for ${d.company}`);

      const [r] = await tx
        .insert(schema.rfqs)
        .values({
          orgId: org.id,
          rfqNumber: d.rfqNumber,
          customerId: cust.id,
          contactId: ct.id,
          subject: d.subject,
          source: "manual",
          quantityBreaks: [1, 10, 100],
          status: d.status,
          declinedAt: d.declinedAt ?? null,
          declinedReason: d.declinedReason ?? null,
          receivedAt: d.receivedAt,
          lastEmailAt: d.lastEmailAt ?? d.receivedAt,
        })
        .returning();
      if (!r) throw new Error(`Failed to insert demo RFQ ${d.rfqNumber}`);

      if (d.parts.length > 0) {
        await tx.insert(schema.parts).values(
          d.parts.map((p, i) => ({
            orgId: org.id,
            rfqId: r.id,
            partNumber: `P-${d.rfqNumber}-${i + 1}`,
            description: p.description,
            processType: "cnc_milling",
            sortOrder: i,
            isNoBid: p.isNoBid,
          })),
        );
      }

      if (d.quote) {
        await tx.insert(schema.quotes).values({
          orgId: org.id,
          rfqId: r.id,
          quoteNumber: d.quote.quoteNumber,
          status: d.quote.status,
          sentAt: d.quote.sentAt ?? null,
        });
      }
    }

    console.log(`Seeded ${DEMO.length} status-pill demo RFQs (#${DEMO_NUMBERS[0]}–#${DEMO_NUMBERS[DEMO_NUMBERS.length - 1]})`);
  });

  console.log("Test RFQ seed complete.");
  await client.end();
}

seedRfq().catch((err) => {
  console.error("Seed RFQ failed:", err);
  process.exit(1);
});
