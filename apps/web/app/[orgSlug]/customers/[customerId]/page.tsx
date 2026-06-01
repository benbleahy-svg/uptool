import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { customerService } from "@uptool/services";
import { addContact, removeContact } from "./actions";

interface Props {
  params: Promise<{ orgSlug: string; customerId: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  estimated: "bg-yellow-100 text-yellow-800",
  quoted: "bg-orange-100 text-orange-800",
  sent: "bg-purple-100 text-purple-800",
  no_bid: "bg-gray-100 text-gray-600",
};

export default async function CustomerDetailPage({ params }: Props) {
  const { orgSlug, customerId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const customer = await customerService.findById(org.id, customerId);
  if (!customer) notFound();

  const [tC, tStatus] = await Promise.all([
    getTranslations("customers"),
    getTranslations("rfqs.status"),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${orgSlug}/customers`}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          ← {tC("title")}
        </Link>
        <span className="text-[hsl(var(--muted-foreground))]">/</span>
        <h1 className="text-base font-semibold">{customer.name}</h1>
        {customer.domain && (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{customer.domain}</span>
        )}
      </div>

      {/* Contacts */}
      <section>
        <h2 className="text-sm font-semibold mb-3">{tC("contacts_title")}</h2>
        <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden mb-3">
          {customer.contacts.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">—</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--muted)/0.4)]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    {tC("contact_name")}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    {tC("contact_email")}
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {customer.contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-4 py-2">{contact.name ?? "—"}</td>
                    <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{contact.email}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={removeContact}>
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="customerId" value={customerId} />
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button type="submit" className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600">
                          ✕
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add contact form */}
        <details className="group">
          <summary className="text-xs font-medium text-[hsl(var(--primary))] cursor-pointer list-none hover:underline">
            + {tC("add_contact")}
          </summary>
          <form action={addContact} className="mt-3 flex gap-2 items-end">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="customerId" value={customerId} />
            <div>
              <label htmlFor="new-contact-name" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                {tC("contact_name")}
              </label>
              <input
                id="new-contact-name"
                name="name"
                className="rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div>
              <label htmlFor="new-contact-email" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
                {tC("contact_email")}
              </label>
              <input
                id="new-contact-email"
                name="email"
                type="email"
                required
                className="rounded border border-[hsl(var(--border))] px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              {tC("add_contact")}
            </button>
          </form>
        </details>
      </section>

      {/* RFQ history */}
      <section>
        <h2 className="text-sm font-semibold mb-3">{tC("rfq_history")}</h2>
        {customer.rfqs.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">—</p>
        ) : (
          <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {customer.rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                      #{rfq.rfqNumber}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/${orgSlug}/rfqs/${rfq.rfqNumber}/thread`}
                        className="hover:text-[hsl(var(--primary))] transition-colors"
                      >
                        {rfq.subject ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[rfq.status] ?? ""}`}
                      >
                        {tStatus(rfq.status as Parameters<typeof tStatus>[0])}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {rfq.receivedAt.toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
