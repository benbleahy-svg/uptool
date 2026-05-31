import { resolveRfq } from "@/lib/resolve-rfq";
import { db } from "@uptool/db";
import { QuoteView } from "./quote-view";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

// The Quote stage is reached from the RFQ sidebar once every part is finalised
// (Complete or No Bid). Line/price data is still stubbed client-side (see
// quote-data.ts); the Customer Information panel is sourced from the real RFQ.
export default async function QuotePage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam } = await params;

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  const rfq = org ? await resolveRfq(org.id, rfqParam) : undefined;

  const customer = rfq?.customer
    ? {
        contact: rfq.contact?.name ?? rfq.contact?.email ?? "—",
        organization: rfq.customer.name,
      }
    : undefined;

  return (
    <QuoteView
      customer={customer}
      orgSlug={orgSlug}
      rfqParam={rfqParam}
      rfqId={rfq?.id ?? rfqParam}
      rfqNumber={rfq?.rfqNumber ?? (Number.parseInt(rfqParam, 10) || 0)}
    />
  );
}
