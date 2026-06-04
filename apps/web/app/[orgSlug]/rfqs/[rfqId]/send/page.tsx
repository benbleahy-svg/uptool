import { resolveRfq } from "@/lib/resolve-rfq";
import { db } from "@uptool/db";
import { quoteService } from "@uptool/services";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SendView } from "./send-view";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

// Send stage: preview + email the RFQ's current quote. The PDF (preview AND
// attachment) is the DIN-5008 document rendered from PERSISTED rows by
// /api/quotes/[id]/pdf. Status transitions live in quoteService.sendQuote.
export default async function SendPage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam } = await params;

  const org = await db.query.orgs.findFirst({ where: (o, { eq }) => eq(o.slug, orgSlug) });
  if (!org) notFound();
  const rfq = await resolveRfq(org.id, rfqParam);
  if (!rfq) notFound();

  const current = await quoteService.getCurrentQuote(org.id, rfq.id);
  const t = await getTranslations("send");

  if (!current) {
    return (
      <div className="grid h-full place-items-center p-8 text-sm text-[hsl(var(--muted-foreground))]">
        {t("no_quote_to_send")}
      </div>
    );
  }

  const defaultBody = [
    "Sehr geehrte Damen und Herren,",
    "",
    `vielen Dank für Ihre Anfrage. Im Anhang finden Sie unser Angebot #${current.quoteNumber}.`,
    "",
    "Mit freundlichen Grüßen",
  ].join("\n");

  return (
    <SendView
      orgSlug={orgSlug}
      rfqParam={rfqParam}
      rfqId={rfq.id}
      quoteId={current.id}
      quoteNumber={current.quoteNumber}
      status={current.status}
      sentAtISO={current.sentAt ? current.sentAt.toISOString() : null}
      hasSentQuote={current.hasSentQuote}
      defaultTo={rfq.contact?.email ?? ""}
      defaultSubject={`Angebot #${current.quoteNumber}${rfq.subject ? ` — ${rfq.subject}` : ""}`}
      defaultBody={defaultBody}
    />
  );
}
