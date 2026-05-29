import { resolveRfq } from "@/lib/resolve-rfq";
import { db } from "@uptool/db";
import { EstimateView } from "./estimate-view";
import { MOCK_RFQ_PARTS, getMockPart } from "./mocks/mockPart";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string; partId: string }>;
}

export default async function EstimatePartPage({ params }: Props) {
  const { orgSlug, rfqId: rfqParam, partId } = await params;
  const part = getMockPart(partId);

  if (!part) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium">Part not found</p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            There is no estimate data for this part.
          </p>
        </div>
      </div>
    );
  }

  // Ordered part ids drive the footer nav; completion is keyed by the resolved
  // RFQ id so it matches the RFQ sidebar. Falls back to mock parts for the
  // standalone demo (when the current part id isn't a real RFQ part).
  let rfqId = rfqParam;
  let partIds = MOCK_RFQ_PARTS.map((p) => p.id);

  const org = await db.query.orgs.findFirst({
    where: (o, { eq }) => eq(o.slug, orgSlug),
  });
  if (org) {
    const rfq = await resolveRfq(org.id, rfqParam);
    if (rfq) {
      rfqId = rfq.id;
      const realIds = (rfq.parts ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => p.id);
      if (realIds.includes(partId)) partIds = realIds;
    }
  }

  return (
    <EstimateView
      part={part}
      orgSlug={orgSlug}
      rfqParam={rfqParam}
      rfqId={rfqId}
      partIds={partIds}
    />
  );
}
