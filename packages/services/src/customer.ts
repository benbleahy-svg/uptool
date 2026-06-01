import { contacts, customers, aiRuns, db } from "@uptool/db";
import { eq, and } from "drizzle-orm";
import {
  deriveCustomerName,
  emailDomain,
  type CustomerSource,
  type DerivationResult,
} from "./derive-customer-name";

export type { CustomerSource };

export const customerService = {
  async findOrCreate(
    tx: typeof db,
    orgId: string,
    fromEmail: string,
    fromName?: string,
    bodyText?: string,
  ): Promise<{ customerId: string | null; contactId: string }> {
    const email = fromEmail.toLowerCase();
    const domain = emailDomain(email);

    // Check if contact already exists
    const existingContact = await tx.query.contacts.findFirst({
      where: (c, { and, eq }) => and(eq(c.orgId, orgId), eq(c.email, email)),
    });
    if (existingContact) {
      return { customerId: existingContact.customerId, contactId: existingContact.id };
    }

    // Deduplication: find existing customer by domain
    let customerId: string | null = null;
    const existingCustomer = domain
      ? await tx.query.customers.findFirst({
          where: (c, { and, eq }) => and(eq(c.orgId, orgId), eq(c.domain, domain)),
        })
      : null;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const derivation: DerivationResult = await deriveCustomerName({
        fromEmail: email,
        fromName,
        bodyText,
      });

      const [newCustomer] = await tx
        .insert(customers)
        .values({
          orgId,
          name: derivation.name,
          domain: domain || null,
          source: derivation.source,
          extractionConfidence: derivation.confidence,
        })
        .returning();

      customerId = newCustomer?.id ?? null;

      // Log AI run inside the org-context transaction
      if (derivation.aiRunData && customerId) {
        await tx.insert(aiRuns).values({
          orgId,
          model: derivation.aiRunData.model,
          promptVersion: derivation.aiRunData.promptVersion,
          inputHash: derivation.aiRunData.inputHash,
          outputJsonb: derivation.aiRunData.outputJsonb,
          latencyMs: derivation.aiRunData.latencyMs,
          costUsd: derivation.aiRunData.costUsd,
        });
      }
    }

    const [newContact] = await tx
      .insert(contacts)
      .values({ orgId, customerId, email, name: fromName ?? null })
      .returning();

    if (!newContact) throw new Error("Failed to create contact");
    return { customerId, contactId: newContact.id };
  },

  async deriveFromEmail(opts: {
    orgId: string;
    fromEmail: string;
    fromName?: string;
    bodyText?: string;
  }): Promise<{ name: string; source: CustomerSource; confidence: string | null }> {
    const result = await deriveCustomerName(opts);
    return { name: result.name, source: result.source, confidence: result.confidence };
  },

  async findByOrg(orgId: string) {
    return db.query.customers.findMany({
      where: (c, { eq }) => eq(c.orgId, orgId),
      with: { contacts: true },
      orderBy: (c, { asc }) => [asc(c.name)],
    });
  },

  async findAll(orgId: string) {
    const rows = await db.query.customers.findMany({
      where: (c, { eq }) => eq(c.orgId, orgId),
      with: {
        contacts: true,
        rfqs: { orderBy: (r, { desc }) => [desc(r.receivedAt)] },
      },
      orderBy: (c, { asc }) => [asc(c.name)],
    });

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      contactCount: c.contacts.length,
      contactEmails: c.contacts.map((ct) => ct.email),
      // Total RFQs for this customer (all states, including declined) — matches
      // the "RFQs" column in the Customers dashboard reference.
      rfqCount: c.rfqs.length,
      lastRfqAt: c.rfqs[0]?.receivedAt ?? null,
    }));
  },

  /** Create a company (customer) manually from the Add Company flow. */
  async createCompany(orgId: string, name: string, domain?: string) {
    const [customer] = await db
      .insert(customers)
      .values({ orgId, name, domain: domain || null, source: "manual" })
      .returning();
    if (!customer) throw new Error("Failed to create company");
    return customer;
  },

  async findById(orgId: string, customerId: string) {
    return db.query.customers.findFirst({
      where: (c, { and, eq }) => and(eq(c.orgId, orgId), eq(c.id, customerId)),
      with: {
        contacts: { orderBy: (c, { asc }) => [asc(c.createdAt)] },
        rfqs: {
          orderBy: (r, { desc }) => [desc(r.receivedAt)],
          limit: 20,
          with: { assignee: true },
        },
      },
    });
  },

  async addContact(orgId: string, customerId: string, email: string, name?: string) {
    const [contact] = await db
      .insert(contacts)
      .values({ orgId, customerId, email: email.toLowerCase(), name: name ?? null })
      .returning();
    if (!contact) throw new Error("Failed to create contact");
    return contact;
  },

  async removeContact(orgId: string, contactId: string) {
    await db
      .delete(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)));
  },
};
