import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

// Retired: the canonical Send page is /{org}/rfqs/{rfq}/send (DIN-5008 PDF from
// persisted rows + the real send flow). This legacy iframe/FormData route now
// redirects there.
export default async function RetiredQuoteSendPage({ params }: Props) {
  const { orgSlug, rfqId } = await params;
  redirect(`/${orgSlug}/rfqs/${rfqId}/send`);
}
