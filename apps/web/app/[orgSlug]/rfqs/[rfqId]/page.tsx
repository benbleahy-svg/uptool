import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ orgSlug: string; rfqId: string }>;
}

export default async function RfqDetailPage({ params }: Props) {
  const { orgSlug, rfqId } = await params;
  redirect(`/${orgSlug}/rfqs/${rfqId}/thread`);
}
