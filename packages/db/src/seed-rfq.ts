import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://uptool:uptool@localhost:5432/uptool";

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seedRfq() {
  console.log("Seeding test RFQ...");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, "acme"),
  });

  if (!org) {
    console.error("Org 'acme' not found — run pnpm db:seed first.");
    await client.end();
    process.exit(1);
  }

  const existing = await db.query.rfqs.findFirst({
    where: (r, { and, eq }) => and(eq(r.orgId, org.id), eq(r.rfqNumber, 1004)),
  });

  if (existing) {
    console.log("Test RFQ 1004 already exists — skipping.");
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${org.id}, true)`);

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
        quantityBreaks: [1, 5, 25],
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

    await tx.insert(schema.emailMessages).values({
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
        Menge: 1 / 5 / 25 Stück
        Zeichnung und STEP-Datei im Anhang

Pos. 2: Anschlussplatte AP-12 (Edelstahl 1.4301, gefräst)
        Menge: 1 / 5 / 25 Stück
        Zeichnung und STEP-Datei im Anhang

Pos. 3: Haltebügel HB-07 (DC01, Biegeteil)
        Menge: 1 / 5 / 25 Stück
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
    });

    // Attachments: 2 drawings (PDF), 2 CAD (STEP), 1 other (spec PDF categorized as 'other')
    await tx.insert(schema.attachments).values([
      {
        orgId: org.id,
        rfqId: rfq.id,
        filename: "VB-40_Zeichnung_Rev3.pdf",
        contentType: "application/pdf",
        sizeBytes: 418_600,
        storageKey: "acme/attachments/vb40-zeichnung-rev3.pdf",
        category: "drawing",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        filename: "AP-12_Zeichnung_Rev1.pdf",
        contentType: "application/pdf",
        sizeBytes: 312_400,
        storageKey: "acme/attachments/ap12-zeichnung-rev1.pdf",
        category: "drawing",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        filename: "VB-40_3D-Modell.step",
        contentType: "application/octet-stream",
        sizeBytes: 2_840_000,
        storageKey: "acme/attachments/vb40-3d-modell.step",
        category: "cad",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        filename: "AP-12_3D-Modell.step",
        contentType: "application/octet-stream",
        sizeBytes: 1_175_000,
        storageKey: "acme/attachments/ap12-3d-modell.step",
        category: "cad",
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        filename: "Technische_Lieferbedingungen_VogtGmbH.pdf",
        contentType: "application/pdf",
        sizeBytes: 89_200,
        storageKey: "acme/attachments/technische-lieferbedingungen.pdf",
        category: "other",
      },
    ]);

    // Parts
    await tx.insert(schema.parts).values([
      {
        orgId: org.id,
        rfqId: rfq.id,
        partNumber: "VB-40",
        revision: "Rev. 3",
        description: "Verteilerblock Hydraulik",
        material: "EN AW-6082 T6",
        processType: "cnc_milling",
        notesExternal: "Alle Bohrungen H7, Oberfläche eloxiert natur",
        sortOrder: 0,
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partNumber: "AP-12",
        revision: "Rev. 1",
        description: "Anschlussplatte",
        material: "1.4301 (AISI 304)",
        processType: "cnc_milling",
        notesExternal: "Gewinde M6 tief 12 mm, Ra 1.6 auf Dichtfläche",
        sortOrder: 1,
      },
      {
        orgId: org.id,
        rfqId: rfq.id,
        partNumber: "HB-07",
        revision: "Rev. 2",
        description: "Haltebügel",
        material: "DC01 t=2.0 mm",
        processType: "sheet_metal",
        notesExternal: "Verzinkung galvanisch 8–12 µm",
        sortOrder: 2,
      },
    ]);

    console.log(`Created RFQ #1004 for ${customer.name}`);
    console.log("  Parts: VB-40 (CNC milling), AP-12 (CNC milling), HB-07 (Sheet metal)");
    console.log("  Attachments: 2 drawings, 2 CAD files, 1 other");
  });

  console.log("Test RFQ seed complete.");
  await client.end();
}

seedRfq().catch((err) => {
  console.error("Seed RFQ failed:", err);
  process.exit(1);
});
