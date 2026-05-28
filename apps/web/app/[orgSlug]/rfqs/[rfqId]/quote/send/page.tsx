import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { quoteService } from "@uptool/services";
import { resolveRfq } from "@/lib/resolve-rfq";
import { sendQuote } from "../actions";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

export default async function SendQuotePage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam } = await params;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await resolveRfq(org.id, rfqParam);
  if (!rfq) notFound();
  const rfqId = rfq.id;

  const quotes = await quoteService.findByRfq(org.id, rfqId);

  const t = await getTranslations("send");

  const quote = quotes.find((q) => q.status === "draft") ?? quotes[0];

  if (!quote) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("no_quote_to_send")}</p>
    );
  }

  const defaultTo = rfq?.contact?.email ?? "";
  const defaultSubject = `Angebot #${quote.quoteNumber}${rfq?.subject ? ` — ${rfq.subject}` : ""}`;

  const sentQuote = quote.status === "sent";

  return (
    <div className="max-w-2xl space-y-6">
      {sentQuote && quote.sentAt && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {t("sent_at", { date: new Date(quote.sentAt).toLocaleString() })}
        </div>
      )}

      {/* PDF preview */}
      <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
        <iframe
          src={`/api/quotes/${quote.id}/pdf`}
          className="w-full h-96"
          title={`Quote ${quote.quoteNumber} PDF`}
        />
      </div>

      {/* Email composer */}
      <form action={sendQuote} className="space-y-4">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="rfqId" value={rfqId} />
        <input type="hidden" name="quoteId" value={quote.id} />

        <div>
          <label htmlFor="send-to" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("to")}
          </label>
          <input
            id="send-to"
            name="toEmail"
            type="email"
            required
            defaultValue={defaultTo}
            className="w-full rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <div>
          <label htmlFor="send-subject" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("subject")}
          </label>
          <input
            id="send-subject"
            name="subject"
            type="text"
            required
            defaultValue={defaultSubject}
            className="w-full rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <div>
          <label htmlFor="send-body" className="block text-xs text-[hsl(var(--muted-foreground))] mb-1">
            {t("body")}
          </label>
          <textarea
            id="send-body"
            name="bodyText"
            rows={6}
            defaultValue={`Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Im Anhang finden Sie unser Angebot #${quote.quoteNumber}.\n\nMit freundlichen Grüßen`}
            className="w-full rounded border border-[hsl(var(--border))] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          {t("send_quote")}
        </button>
      </form>
    </div>
  );
}
