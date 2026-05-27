import { contacts, customers, db } from "@uptool/db";
import { eq, and } from "drizzle-orm";

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export const customerService = {
  async findOrCreate(
    tx: typeof db,
    orgId: string,
    fromEmail: string,
    fromName?: string,
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

    // Find existing customer by domain
    let customerId: string | null = null;
    if (domain) {
      const existingCustomer = await tx.query.customers.findFirst({
        where: (c, { and, eq }) => and(eq(c.orgId, orgId), eq(c.domain, domain)),
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const [newCustomer] = await tx
          .insert(customers)
          .values({ orgId, name: domain, domain })
          .returning();
        customerId = newCustomer?.id ?? null;
      }
    }

    // Create contact
    const [newContact] = await tx
      .insert(contacts)
      .values({ orgId, customerId, email, name: fromName ?? null })
      .returning();

    if (!newContact) throw new Error("Failed to create contact");
    return { customerId, contactId: newContact.id };
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
      openRfqCount: c.rfqs.filter(
        (r) => !["won", "lost", "no_bid"].includes(r.status),
      ).length,
      lastRfqAt: c.rfqs[0]?.receivedAt ?? null,
    }));
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
