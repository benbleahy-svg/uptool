import { getTranslations } from "next-intl/server";
import { db } from "@uptool/db";
import { notFound } from "next/navigation";
import { quoteService, partService } from "@uptool/services";
import { QuoteForm, type QuoteLineItem } from "./quote-form";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

export default async function QuotePage({ params }: Props) {
  const { orgSlug, rfqId } = await params;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (!org) notFound();

  const rfq = await db.query.rfqs.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, rfqId), eq(r.orgId, org.id)),
    columns: { quantityBreaks: true },
  });
  if (!rfq) notFound();

  const quantityBreaks = rfq.quantityBreaks?.length ? rfq.quantityBreaks : [1, 10, 100];

  const [partsWithOps, existingQuotes] = await Promise.all([
    partService.findByRfq(org.id, rfqId),
    quoteService.findByRfq(org.id, rfqId),
  ]);

  const t = await getTranslations("quote");

  if (partsWithOps.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{t("no_quote")}</p>
    );
  }

  const draftQuote = existingQuotes.find((q) => q.status === "draft") ?? existingQuotes[0];

  const lineItems: QuoteLineItem[] = [];

  for (const part of partsWithOps) {
    const costs = partService.computeCostsForPart(part, part.operations, quantityBreaks);
    const label = [part.partNumber, part.revision ? `Rev ${part.revision}` : null, part.description]
      .filter(Boolean)
      .join(" ");

    for (const { quantity, costPerUnitCents } of costs) {
      const existing = draftQuote?.lineItems.find(
        (li) => li.partId === part.id && li.quantity === quantity,
      );
      const markupPct = existing ? Number(existing.markupPct) : 30;
      const leadTimeWeeks = existing?.leadTimeWeeks ?? null;
      const isNoBid = existing?.isNoBid ?? false;
      const quotePriceCents = quoteService.computeQuotePrice(costPerUnitCents, markupPct);

      lineItems.push({
        partId: part.id,
        partLabel: label || "—",
        quantity,
        costPerUnitCents,
        markupPct,
        quotePriceCents,
        leadTimeWeeks,
        isNoBid,
      });
    }
  }

  return (
    <div className="max-w-4xl">
      <QuoteForm
        orgSlug={orgSlug}
        rfqId={rfqId}
        lineItems={lineItems}
        notesForCustomer={draftQuote?.notesForCustomer ?? ""}
        hasDraft={!!draftQuote}
        draftQuoteId={draftQuote?.id ?? null}
        labels={{
          part: t("part"),
          qty: t("qty"),
          costPerUnit: t("cost_per_unit"),
          markupPct: t("markup_pct"),
          quotePrice: t("quote_price"),
          leadTimeWeeks: t("lead_time_weeks"),
          noBid: t("no_bid"),
          notesForCustomer: t("notes_for_customer"),
          create: t("create"),
          update: t("update"),
          downloadPdf: t("download_pdf"),
          goToSend: t("go_to_send"),
          showCost: t("show_cost"),
          hideCost: t("hide_cost"),
        }}
      />
    </div>
  );
}
